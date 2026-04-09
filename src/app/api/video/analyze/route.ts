import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { setUploadProgress } from "../upload-progress/route";

// Initialize Fireworks AI
const fireworks = createOpenAICompatible({
  name: "fireworks",
  baseURL: "https://api.fireworks.ai/inference/v1",
  headers: {
    Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}`,
  },
});

// Utility to truncate text to max length
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

// Get video duration using ffprobe
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

// Helper to send periodic progress updates during long operations
function createProgressUpdater(
  analyzeId: string,
  startProgress: number,
  endProgress: number,
  baseStatus: string,
) {
  let currentProgress = startProgress;
  const interval = setInterval(() => {
    currentProgress += 1;
    if (currentProgress < endProgress) {
      setUploadProgress(analyzeId, currentProgress, `${baseStatus}`);
    }
  }, 2000); // Update every 2 seconds

  return {
    stop: () => clearInterval(interval),
    getProgress: () => currentProgress,
  };
}

// Extract multiple keyframes at strategic timestamps
async function extractKeyframes(
  videoPath: string,
  tempDir: string,
): Promise<string[]> {
  const duration = await getVideoDuration(videoPath);

  // Determine frame sampling strategy based on video length
  let timestamps: string[] = [];

  if (duration <= 30) {
    // Short videos (< 30s): 3 evenly distributed frames
    timestamps = [
      "0.5", // Start (skip very first frame which may be black)
      String(Math.max(1, duration * 0.5)), // Middle
      String(Math.max(2, duration - 1)), // End
    ];
  } else if (duration <= 180) {
    // Medium videos (30s - 3min): 4 frames
    timestamps = [
      "1.0", // Early
      String(duration * 0.25), // Quarter
      String(duration * 0.5), // Middle
      String(duration * 0.75), // Three quarters
    ];
  } else {
    // Long videos (> 3min): 5 frames at strategic points
    timestamps = [
      "2.0", // Skip intro, capture early content
      String(duration * 0.15), // Setup/context
      String(duration * 0.35), // Early action
      String(duration * 0.6), // Main content
      String(duration * 0.85), // Climax/late content
    ];
  }

  // Ensure timestamps are within bounds
  timestamps = timestamps.filter((t) => parseFloat(t) < duration).slice(0, 5);

  const framePaths: string[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const framePath = path.join(tempDir, `frame_${i}.jpg`);
    framePaths.push(framePath);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamps[i]],
          filename: `frame_${i}.jpg`,
          folder: tempDir,
          size: "1280x720",
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });
  }

  return framePaths;
}

// Fetch YouTube search suggestions for trending keywords
async function getYouTubeSearchSuggestions(keyword: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(keyword)}&hl=en`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) return [];

    const text = await response.text();
    // Parse JSONP response
    const match = text.match(/\((.*)\)/);
    if (match) {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data[1])) {
        return data[1].map((item: any) => item[0]).slice(0, 10);
      }
    }
    return [];
  } catch (error) {
    console.error("Failed to get search suggestions:", error);
    return [];
  }
}

// Fetch trending keywords for a topic
async function fetchTrendingKeywords(
  mainTopic: string,
  relatedTerms: string[],
): Promise<string[]> {
  const allSuggestions: string[] = [];

  // Get suggestions for main topic
  const topicSuggestions = await getYouTubeSearchSuggestions(mainTopic);
  allSuggestions.push(...topicSuggestions);

  // Get suggestions for related terms
  for (const term of relatedTerms.slice(0, 3)) {
    const suggestions = await getYouTubeSearchSuggestions(term);
    allSuggestions.push(...suggestions);
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  // Remove duplicates and return
  return [...new Set(allSuggestions)].slice(0, 15);
}

// Get content strategy based on video type
function getContentStrategy(contentType: string) {
  const strategies: Record<
    string,
    {
      hooks: string[];
      titlePatterns: string[];
      bestTime: string;
      hashtags: string[];
    }
  > = {
    tutorial: {
      hooks: ["Learn", "How to", "Step-by-step", "Beginner's guide", "Master"],
      titlePatterns: [
        "How to [X] in [Y] minutes",
        "[X] Tutorial for Beginners",
        "Learn [X] Fast",
      ],
      bestTime: "Weekday evenings 6-9pm",
      hashtags: ["#tutorial", "#howto", "#learn", "#education"],
    },
    gaming: {
      hooks: ["EPIC", "Reacting to", "First time", "Speedrun", "Pro vs"],
      titlePatterns: [
        "[Game] but [Challenge]",
        "Reacting to [Trend]",
        "I Played [X] for 24 Hours",
      ],
      bestTime: "Afternoons 2-6pm, Weekends",
      hashtags: ["#gaming", "#gameplay", "#letsplay", "#gamer"],
    },
    vlog: {
      hooks: ["Day in the life", "24 hours", "Behind the scenes", "I spent"],
      titlePatterns: [
        "Day in my life as [X]",
        "I [did X] for 24 hours",
        "Behind the Scenes",
      ],
      bestTime: "Weekday mornings 8-10am, Sunday evenings",
      hashtags: ["#vlog", "#dayinmylife", "#lifestyle", "#daily"],
    },
    review: {
      hooks: ["Honest review", "After 30 days", "Is it worth it?", "Real test"],
      titlePatterns: [
        "[Product] After 30 Days",
        "[A] vs [B]: Honest Comparison",
        "Is [X] Worth It?",
      ],
      bestTime: "Wednesday-Saturday evenings",
      hashtags: ["#review", "#honest", ""],
    },
    comedy: {
      hooks: ["POV", "When you", "Relatable", "Expectation vs Reality"],
      titlePatterns: ["POV: You're [X]", "When [Relatable]", "Types of [X]"],
      bestTime: "Friday-Sunday evenings",
      hashtags: ["#comedy", "#funny", "#pov", "#relatable"],
    },
    fitness: {
      hooks: ["30 day challenge", "Transformation", "Results", "Science-based"],
      titlePatterns: [
        "I Did [X] for 30 Days",
        "Science-Based [X]",
        "[X] at Home",
      ],
      bestTime: "Monday mornings, Sunday evenings",
      hashtags: ["#fitness", "#workout", "#gym", "#health"],
    },
    cooking: {
      hooks: ["Easy", "5 ingredients", "Budget", "Authentic", "Quick"],
      titlePatterns: [
        "[X] with Only 5 Ingredients",
        "$[X] Budget Meals",
        "Authentic [Cuisine]",
      ],
      bestTime: "Thursday-Saturday before meal times",
      hashtags: ["#cooking", "#recipe", "#food", "#easyrecipe"],
    },
    music: {
      hooks: ["Cover", "Reaction", "Acoustic", "Live", "Remix"],
      titlePatterns: [
        "[Song] Cover by [Artist]",
        "Reacting to [Artist]",
        "Acoustic [Song]",
      ],
      bestTime: "Friday evenings, Weekend afternoons",
      hashtags: ["#music", "#cover", "#acoustic", "#song"],
    },
    tech: {
      hooks: ["New", "Review", "Setup", "Test", "Comparison"],
      titlePatterns: [
        "New [Gadget] Review",
        "[A] vs [B] Test",
        "My [Tech] Setup",
      ],
      bestTime: "Tuesday-Thursday evenings",
      hashtags: ["#tech", "#technology", "#review", "#gadget"],
    },
    travel: {
      hooks: ["Hidden gem", "First time", "$[X] challenge", "Backpacking"],
      titlePatterns: [
        "Hidden [Place] You Must Visit",
        "[X] Days in [Country]",
        "$[X] Travel Challenge",
      ],
      bestTime: "Friday evenings, Sunday afternoons",
      hashtags: ["#travel", "#travelvlog", "#backpacking", "#wanderlust"],
    },
    default: {
      hooks: ["Amazing", "Secret", "Discover", "Ultimate", "Complete"],
      titlePatterns: [
        "The Ultimate [X] Guide",
        "[Number] [X] Secrets",
        "Amazing [X]",
      ],
      bestTime: "Weekday evenings 6-9pm",
      hashtags: ["#viral", "#trending", "#video", "#youtube"],
    },
  };

  return strategies[contentType.toLowerCase()] || strategies.default;
}

// Generate 1-2 strategic hashtags for title
function generateTitleHashtags(title: string, topic: string = ""): string[] {
  const words = title.toLowerCase().split(/\s+/);
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "and",
    "but",
    "or",
    "yet",
    "so",
    "if",
    "because",
    "although",
    "though",
    "while",
    "where",
    "when",
    "that",
    "which",
    "who",
    "whom",
    "whose",
    "what",
    "this",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
    "my",
    "your",
    "his",
    "her",
    "its",
    "our",
    "their",
  ]);

  // Extract key topic words
  const keyWords: string[] = [];

  // Add topic if it's a single word
  if (topic && !topic.includes(" ") && topic.length > 3) {
    keyWords.push(topic.toLowerCase());
  }

  // Add words from title
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, "");
    if (clean.length > 3 && !commonWords.has(clean) && keyWords.length < 2) {
      keyWords.push(clean);
    }
  }

  // Return 1-2 most relevant hashtags
  return keyWords.slice(0, 2).map((w) => "#" + w);
}

// Optimize title for virality (80-100 chars optimal)
function optimizeTitle(title: string, topic: string = ""): string {
  const maxTitleLength = 100;
  const minTitleLength = 70; // Sweet spot for mobile visibility

  let optimizedTitle = title.trim();

  // Ensure minimum length for impact
  if (optimizedTitle.length < minTitleLength) {
    // Title too short - add power words or specificity
    const powerAdditions = [
      "(Full Guide)",
      "- Step by Step",
      "- Pro Tips",
      "(2025)",
    ];
    for (const addition of powerAdditions) {
      if (optimizedTitle.length + addition.length <= maxTitleLength) {
        optimizedTitle += addition;
        break;
      }
    }
  }

  // Truncate if over limit
  if (optimizedTitle.length > maxTitleLength) {
    optimizedTitle = truncate(optimizedTitle, maxTitleLength);
  }

  // Add 1-2 strategic hashtags if space permits AND it looks natural
  const hashtags = generateTitleHashtags(title, topic);
  const hashtagsStr = hashtags.join(" ");

  // Only add hashtags if we have room and title isn't already long
  if (
    hashtagsStr &&
    optimizedTitle.length + hashtagsStr.length + 1 <= maxTitleLength &&
    optimizedTitle.length < 85
  ) {
    optimizedTitle = optimizedTitle + " " + hashtagsStr;
  }

  return optimizedTitle;
}

// Optimize tags for virality - strategic 8-12 tags
function optimizeTags(
  tags: string[],
  trendingSearches: string[] = [],
): string[] {
  const maxTags = 12;
  const maxTotalLength = 500;

  // Clean and deduplicate input tags
  const cleanedTags = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length <= 50); // Reasonable tag length

  // Clean trending searches - keep full phrases as they indicate search intent
  const trendingTags = trendingSearches
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 2 && s.length <= 40); // Limit to reasonable phrases

  // Strategy: Prioritize by search intent value
  // 1. High-intent specific tags (exact topic match)
  // 2. Trending search terms (what people are actually searching)
  // 3. Broad category tags

  const seen = new Set<string>();
  const prioritizedTags: string[] = [];

  // Add trending searches first (high value)
  for (const tag of trendingTags) {
    if (!seen.has(tag) && prioritizedTags.length < maxTags) {
      seen.add(tag);
      prioritizedTags.push(tag);
    }
  }

  // Add specific niche tags
  for (const tag of cleanedTags) {
    if (!seen.has(tag) && prioritizedTags.length < maxTags) {
      seen.add(tag);
      prioritizedTags.push(tag);
    }
  }

  // Calculate total length with commas
  let totalLength = 0;
  const finalTags: string[] = [];

  for (const tag of prioritizedTags) {
    const commaLength = finalTags.length > 0 ? 1 : 0;
    const newTotal = totalLength + commaLength + tag.length;

    // Add if within limits
    if (newTotal <= maxTotalLength) {
      finalTags.push(tag);
      totalLength = newTotal;
    }
  }

  // Aim for 300-400 chars optimal range for tags
  // Don't force fill to 500 - quality over quantity
  return finalTags;
}

// Optimize description for virality - quality over quantity (1500-3000 chars optimal)
function optimizeDescription(
  description: string,
  videoDuration: number = 0,
  contentType: string = "video",
  topic: string = "this topic",
  strategy: { hooks: string[]; hashtags: string[] } = {
    hooks: [],
    hashtags: [],
  },
): string {
  let optimized = description.trim();

  // Ensure key viral elements are present
  const hasTimestamps = optimized.includes("⏰") || optimized.includes("0:");
  const hasCTA =
    optimized.includes("👍") ||
    optimized.includes("LIKE") ||
    optimized.includes("Subscribe");
  const hasHashtags = optimized.includes("#");

  // Add timestamps if missing and video is long enough
  if (!hasTimestamps && videoDuration > 60) {
    const segments = Math.min(Math.floor(videoDuration / 60), 5); // Max 5 timestamps
    let timestamps = "\n\n⏰ TIMESTAMPS:\n";
    timestamps += "0:00 Intro\n";

    for (let i = 1; i <= segments; i++) {
      const mins = Math.floor(((videoDuration / (segments + 1)) * i) / 60);
      timestamps += `${mins}:00 Key moment ${i}\n`;
    }

    optimized += timestamps;
  }

  // Add highlights section if missing
  if (!optimized.includes("🔥") && !optimized.includes("Key Highlights")) {
    optimized += `

🔥 What You'll Learn:
• The exact steps to master ${topic}
• Common mistakes beginners make (avoid these!)
• Pro tips that speed up your progress
• Actionable takeaways you can use today`;
  }

  // Add single strong CTA if missing
  if (!hasCTA) {
    optimized += `

👍 If this ${contentType} helped you, hit LIKE and SUBSCRIBE for more ${topic} content!`;
  }

  // Add hashtags if missing
  if (!hasHashtags && strategy.hashtags.length > 0) {
    const hashTags = strategy.hashtags.slice(0, 4).join(" ");
    optimized += `\n\n${hashTags}`;
  }

  // Trim to reasonable length (1500-3000 optimal for engagement)
  // Don't force fill to 5000 - mobile viewers see first 2-3 lines only
  if (optimized.length > 4000) {
    optimized = optimized.substring(0, 4000);
    // Try to end at a clean break
    const lastBreak = optimized.lastIndexOf("\n");
    if (lastBreak > 3500) {
      optimized = optimized.substring(0, lastBreak);
    }
    optimized += "\n\n👆 Full guide above!";
  }

  return optimized;
}

// Enhanced system prompt with trending data integration
const SYSTEM_PROMPT = `You are an expert YouTube SEO specialist and viral content strategist.

MISSION: Create DISCOVERABLE and CLICKABLE metadata that matches what people are ACTUALLY searching for.

TRENDING KEYWORDS TO INCORPORATE:
The user will provide REAL-TIME trending search suggestions below. Use these popular search terms naturally in your tags and description.

CONTENT STRATEGY BY TYPE:
- Tutorial: Use "How to", "Learn", "Step-by-step" hooks. Best upload: Weekday evenings
- Gaming: Use "EPIC", "Reacting to", "Challenge" hooks. Best upload: Afternoons/Weekends  
- Vlog: Use "Day in life", "24 hours", "Behind scenes" hooks. Best upload: Mornings/Sunday
- Review: Use "Honest", "After 30 days", "Worth it?" hooks. Best upload: Wed-Sat evenings
- Comedy: Use "POV", "When you", "Relatable" hooks. Best upload: Fri-Sun evenings
- Fitness: Use "30 day challenge", "Transformation" hooks. Best upload: Monday morning
- Cooking: Use "Easy", "5 ingredients", "Budget" hooks. Best upload: Thu-Sat
- Music: Use "Cover", "Reaction", "Acoustic" hooks. Best upload: Fri evenings
- Tech: Use "New", "Review", "Test" hooks. Best upload: Tue-Thu evenings

METADATA REQUIREMENTS:

TITLE (VIRAL OPTIMIZATION - Max 100 chars, use 80-100):
Formula: [POWER WORD] + [KEYWORD] + [SPECIFIC BENEFIT] + [NUMBER] + [CURIOSITY GAP]
Power Words: "Learn", "Discover", "Secret", "Ultimate", "Proven", "Fast", "Easy", "Best", "How to", "Why"
Examples: "Learn Python in 10 Minutes (Full Tutorial)" / "5 Secret Tips Experts Don't Tell You"
GOAL: Create irresistible curiosity. Use 80-100 chars. Add 1-2 relevant hashtags ONLY if they fit naturally.

TAGS (VIRAL OPTIMIZATION - 8-12 strategic tags, 300-500 chars):
QUALITY OVER QUANTITY. Focus on SEARCHABLE terms people actually type.
1. 3-4 SPECIFIC niche tags (exact topic, high intent)
2. 2-3 BROAD category tags (single words, high volume)
3. 2-3 TRENDING tags (from provided suggestions)
4. 1-2 LONG-TAIL phrases (complete search phrases)
Strategy: NO duplicates. NO irrelevant tags. Focus on tags that drive targeted traffic.

DESCRIPTION (VIRAL OPTIMIZATION - 1500-3000 chars, quality content):
FIRST 2 LINES ARE CRITICAL (hook + value proposition with keyword)
Structure:
Line 1: COMPELLING HOOK with main keyword (max 100 chars)
Line 2: VALUE PROPOSITION - what they'll gain (1 sentence)
(empty line)
⏰ TIMESTAMPS: Key moments only (3-5 timestamps max)
(empty line)
🔥 KEY HIGHLIGHTS: 3-5 bullet points with specific value
(empty line)
🚀 CTA: Single strong call-to-action
(empty line)
HASHTAGS: 3-5 relevant hashtags at bottom

THUMBNAIL ADVICE:
- Face with expressive emotion (surprise, excitement, curiosity)
- Bright, contrasting colors (yellow, orange, red work best)
- 3 WORDS MAX on thumbnail, large font
- Visual mystery/curiosity gap
- Rule of thirds composition

THUMBNAIL ADVICE:
- High contrast colors that pop
- Expressive face showing emotion
- Clear readable text (max 3 words)
- Visual curiosity gap

Return ONLY valid JSON:
{
  "title": "Optimized click-worthy title",
  "description": "SEO description with timestamps and CTAs",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "categorySuggestion": "Exact YouTube category name",
  "thumbnailDescription": "Detailed thumbnail design advice"
}`;

export async function POST(request: NextRequest) {
  const analyzeId = request.headers.get("X-Analyze-Id");

  if (!analyzeId) {
    return NextResponse.json(
      { error: "Missing analyze ID. Use SSE endpoint first." },
      { status: 400 },
    );
  }

  // Set initial progress immediately
  setUploadProgress(analyzeId, 2, "Starting video analysis...");

  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      setUploadProgress(analyzeId, 0, "Authentication failed", "Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const selectedModel =
      (formData.get("model") as string) ||
      "accounts/fireworks/models/kimi-k2p5";

    if (!videoFile) {
      setUploadProgress(
        analyzeId,
        0,
        "No video file",
        "No video file provided",
      );
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 },
      );
    }

    // Set initial progress immediately
    setUploadProgress(analyzeId, 2, "Initializing analysis...");

    setUploadProgress(analyzeId, 5, "Reading video file...");

    // Create temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-analyze-"));
    const videoPath = path.join(tempDir, "input.mp4");

    // Save video file
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await fs.writeFile(videoPath, videoBuffer);

    setUploadProgress(analyzeId, 10, "Analyzing video structure...");

    // Get video duration
    const duration = await getVideoDuration(videoPath);

    setUploadProgress(analyzeId, 15, "Extracting keyframes from video...");

    // Extract multiple keyframes
    const framePaths = await extractKeyframes(videoPath, tempDir);

    setUploadProgress(
      analyzeId,
      25,
      `${framePaths.length} frames extracted! Preparing AI analysis...`,
    );

    // Read all frames and convert to base64
    const frameDataUrls: string[] = [];

    for (const framePath of framePaths) {
      const frameBuffer = await fs.readFile(framePath);
      frameDataUrls.push(
        `data:image/jpeg;base64,${frameBuffer.toString("base64")}`,
      );
    }

    setUploadProgress(
      analyzeId,
      30,
      "Starting AI video analysis (this may take 20-30 seconds)...",
    );

    // Start progress updater for first AI call (30% -> 40%)
    const topicProgress = createProgressUpdater(
      analyzeId,
      30,
      40,
      "AI analyzing video content",
    );

    // First pass: Get basic analysis to extract topic
    const topicAnalysis = await generateText({
      model: fireworks(selectedModel),
      messages: [
        {
          role: "system",
          content:
            "You are a video analyst. Identify the content type, main topic, and 3-5 related keywords. Respond ONLY with JSON: {contentType, mainTopic, relatedTerms[], targetAudience, videoStyle}",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze these video frames and identify the content. Video duration: ${Math.round(duration)}s`,
            },
            ...frameDataUrls.map((url) => ({
              type: "image" as const,
              image: url,
            })),
          ],
        },
      ],
    });

    // Stop first progress updater
    topicProgress.stop();

    // Parse topic analysis
    let contentInfo: any = {
      contentType: "general",
      mainTopic: "video",
      relatedTerms: [],
    };
    try {
      const jsonMatch = topicAnalysis.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        contentInfo = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log("Could not parse topic analysis, using defaults");
    }

    setUploadProgress(
      analyzeId,
      42,
      `Identified content: ${contentInfo.contentType || "video"} about ${contentInfo.mainTopic || "general topic"}...`,
    );

    // Fetch trending keywords
    const trendingKeywords = await fetchTrendingKeywords(
      contentInfo.mainTopic || "video",
      contentInfo.relatedTerms?.slice(0, 3) || [],
    );

    // Get content strategy
    const strategy = getContentStrategy(contentInfo.contentType || "default");

    setUploadProgress(
      analyzeId,
      50,
      `Found ${trendingKeywords.length} trending keywords! Generating optimized metadata...`,
    );

    // Start progress updater for second AI call (50% -> 70%)
    const metadataProgress = createProgressUpdater(
      analyzeId,
      50,
      70,
      "AI generating viral metadata",
    );

    // Build enhanced prompt with trending data
    const userPromptText = `Create VIRAL-OPTIMIZED YouTube metadata using the provided TRENDING KEYWORDS.

VIDEO ANALYSIS:
- Content Type: ${contentInfo.contentType || "general"}
- Main Topic: ${contentInfo.mainTopic || "video"}
- Target Audience: ${contentInfo.targetAudience || "general"}
- Video Style: ${contentInfo.videoStyle || "standard"}
- Duration: ${Math.round(duration)} seconds

REAL-TIME TRENDING SEARCHES (Incorporate these popular terms):
${trendingKeywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}

CONTENT STRATEGY:
- Recommended Hooks: ${strategy.hooks.slice(0, 5).join(", ")}
- Title Patterns: ${strategy.titlePatterns.slice(0, 3).join("; ")}
- Best Upload Time: ${strategy.bestTime}
- Suggested Hashtags: ${strategy.hashtags.join(" ")}

TASK: Generate metadata that uses these trending keywords naturally to make the video DISCOVERABLE.`;

    // Build message content with images
    const userContent: any[] = [
      { type: "text", text: userPromptText },
      ...frameDataUrls.map((url) => ({ type: "image" as const, image: url })),
    ];

    // Generate final optimized metadata
    const finalResult = await generateText({
      model: fireworks(selectedModel),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    // Stop second progress updater
    metadataProgress.stop();

    setUploadProgress(analyzeId, 85, "Processing AI response...");

    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });

    // Parse the JSON response
    let rawAnalysis;
    try {
      const jsonMatch = finalResult.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", finalResult.text);
      setUploadProgress(
        analyzeId,
        0,
        "Failed to parse AI response",
        "Parse error",
      );
      return NextResponse.json(
        { error: "Failed to parse AI analysis", rawResponse: finalResult.text },
        { status: 500 },
      );
    }

    setUploadProgress(analyzeId, 95, "Optimizing with trending keywords...");

    // Apply optimizations with trending keywords - VIRAL optimization (not max fill)
    const analysis = {
      title: optimizeTitle(
        rawAnalysis.title || "",
        contentInfo.mainTopic || "",
      ),
      description: optimizeDescription(
        rawAnalysis.description || "",
        duration,
        contentInfo.contentType || "video",
        contentInfo.mainTopic || "this topic",
        strategy,
      ),
      tags: optimizeTags(rawAnalysis.tags || [], trendingKeywords),
      categorySuggestion: rawAnalysis.categorySuggestion || "Entertainment",
      thumbnailDescription: rawAnalysis.thumbnailDescription || "",
      trendingKeywordsUsed: trendingKeywords.slice(0, 8), // Fewer, better keywords
      contentStrategy: {
        contentType: contentInfo.contentType || "general",
        recommendedHooks: strategy.hooks.slice(0, 3), // Top 3 hooks only
        provenTitlePatterns: strategy.titlePatterns.slice(0, 2), // Top 2 patterns
        bestUploadTimes: strategy.bestTime,
        suggestedHashtags: strategy.hashtags.slice(0, 4), // 4 best hashtags
      },
    };

    setUploadProgress(analyzeId, 100, "Analysis complete!", undefined);

    // Return analysis results with all frames for display
    return NextResponse.json({
      success: true,
      analysis,
      frameUrl: frameDataUrls[0], // Keep for backward compatibility
      frameUrls: frameDataUrls, // All frames for inline display
      framesAnalyzed: framePaths.length,
      videoDuration: Math.round(duration),
      trendingData: {
        keywordsResearched: trendingKeywords.length,
        keywordsUsed: analysis.trendingKeywordsUsed, // Quality keywords actually used
        contentType: contentInfo.contentType,
        mainTopic: contentInfo.mainTopic,
      },
    });
  } catch (error) {
    console.error("Video analysis error:", error);
    const errorMessage = (error as Error).message;
    setUploadProgress(analyzeId, 0, "Analysis failed", errorMessage);
    return NextResponse.json(
      { error: "Failed to analyze video", details: errorMessage },
      { status: 500 },
    );
  }
}
