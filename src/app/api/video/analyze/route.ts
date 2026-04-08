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

// Add hashtags to title if there's space
function optimizeTitle(title: string): string {
  const maxTitleLength = 100;
  
  // Clean up the title first
  let optimizedTitle = title.trim();
  
  // Generate relevant hashtags based on title content
  const words = optimizedTitle.toLowerCase().split(/\s+/);
  const hashtags: string[] = [];
  
  // Extract key words for hashtags (filter out common words)
  const commonWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "under", "and", "but", "or", "yet", "so", "if", "because", "although", "though", "while", "where", "when", "that", "which", "who", "whom", "whose", "what", "this", "these", "those", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "her", "its", "our", "their", "myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves"]);
  
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z0-9]/g, "");
    if (cleanWord.length > 3 && !commonWords.has(cleanWord) && hashtags.length < 3) {
      hashtags.push("#" + cleanWord);
    }
  }
  
  // Calculate available space for hashtags
  const hashtagsStr = hashtags.join(" ");
  const totalLength = optimizedTitle.length + (hashtags.length > 0 ? 1 + hashtagsStr.length : 0);
  
  if (totalLength <= maxTitleLength && hashtags.length > 0) {
    optimizedTitle = optimizedTitle + " " + hashtagsStr;
  } else if (optimizedTitle.length > maxTitleLength) {
    optimizedTitle = truncate(optimizedTitle, maxTitleLength);
  }
  
  return optimizedTitle;
}

// Optimize and limit tags
function optimizeTags(tags: string[]): string[] {
  const maxTagLength = 500;
  const maxTags = 15; // YouTube recommends 5-15 tags
  
  // Clean and deduplicate tags
  const cleanedTags = tags
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => tag.length > 0)
    .filter((tag, index, self) => self.indexOf(tag) === index);
  
  // Limit number of tags
  const limitedTags = cleanedTags.slice(0, maxTags);
  
  // Check total character length
  let totalLength = 0;
  const finalTags: string[] = [];
  
  for (const tag of limitedTags) {
    const tagLength = tag.length;
    if (tagLength <= maxTagLength && totalLength + tagLength < 2000) {
      finalTags.push(tag);
      totalLength += tagLength + 2; // +2 for comma and space
    }
  }
  
  return finalTags;
}

// Optimize description
function optimizeDescription(description: string): string {
  const maxDescriptionLength = 5000;
  return truncate(description, maxDescriptionLength);
}

export async function POST(request: NextRequest) {
  const analyzeId = request.headers.get("X-Analyze-Id");
  
  if (!analyzeId) {
    return NextResponse.json(
      { error: "Missing analyze ID. Use SSE endpoint first." },
      { status: 400 }
    );
  }

  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      setUploadProgress(analyzeId, 0, "Authentication failed", "Unauthorized");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const selectedModel = formData.get("model") as string || "accounts/fireworks/models/kimi-k2p5";

    if (!videoFile) {
      setUploadProgress(analyzeId, 0, "No video file", "No video file provided");
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    setUploadProgress(analyzeId, 5, "Reading video file...");

    // Create temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-analyze-"));
    const videoPath = path.join(tempDir, "input.mp4");
    const framePath = path.join(tempDir, "frame.jpg");

    // Save video file
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await fs.writeFile(videoPath, videoBuffer);

    setUploadProgress(analyzeId, 15, "Extracting frame from video...");

    // Extract frame using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ["3.0"],
          filename: "frame.jpg",
          folder: tempDir,
          size: "1280x720",
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    setUploadProgress(analyzeId, 35, "Frame extracted! Analyzing with AI...");

    // Read extracted frame
    const frameBuffer = await fs.readFile(framePath);
    const frameBase64 = frameBuffer.toString("base64");

    setUploadProgress(analyzeId, 45, "Sending to AI for analysis...");

    // Analyze frame with Fireworks AI
    const { text } = await generateText({
      model: fireworks(selectedModel),
      messages: [
        {
          role: "system",
          content: `You are an expert YouTube SEO specialist with deep knowledge of trending hashtags and viral content optimization.

STRICT REQUIREMENTS:
- Title: MAXIMUM 100 characters (will be truncated if longer)
- Description: MAXIMUM 5000 characters
- Tags: Each tag MAXIMUM 500 characters, provide 8-15 highly relevant tags
- Use trending, viral-optimized hashtags and keywords
- Focus on searchable terms that will help the video get discovered

Return ONLY this JSON format (no other text):
{
  "title": "Engaging title with relevant keywords (MAX 100 chars)",
  "description": "Compelling description with timestamps, hashtags, and SEO keywords (MAX 5000 chars)",
  "tags": ["viral", "trending", "keyword1", "keyword2", "hashtag-style-tags"],
  "categorySuggestion": "YouTube category name",
  "thumbnailDescription": "Thumbnail design recommendations"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this video frame and create VIRAL-OPTIMIZED YouTube metadata.

Focus on:
1. TRENDING keywords and hashtags that people are searching for
2. VIRAL potential - what makes content shareable?
3. SEARCHABLE terms - what would users type to find this?
4. ENGAGEMENT hooks - what makes people click and watch?

Generate metadata within these STRICT limits:
- Title: 100 characters MAX
- Description: 5000 characters MAX  
- Tags: 8-15 tags, each 500 chars MAX

Use popular hashtags, trending keywords, and viral-optimized language.`,
            },
            {
              type: "image",
              image: `data:image/jpeg;base64,${frameBase64}`,
            },
          ],
        },
      ],
    });

    setUploadProgress(analyzeId, 75, "Processing AI response...");

    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });

    // Parse the JSON response
    let rawAnalysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", text);
      setUploadProgress(analyzeId, 0, "Failed to parse AI response", "Parse error");
      return NextResponse.json(
        { error: "Failed to parse AI analysis", rawResponse: text },
        { status: 500 }
      );
    }

    setUploadProgress(analyzeId, 90, "Optimizing results...");

    // Apply optimizations and enforce limits
    const analysis = {
      title: optimizeTitle(rawAnalysis.title || ""),
      description: optimizeDescription(rawAnalysis.description || ""),
      tags: optimizeTags(rawAnalysis.tags || []),
      categorySuggestion: rawAnalysis.categorySuggestion || "Entertainment",
      thumbnailDescription: rawAnalysis.thumbnailDescription || "",
    };

    setUploadProgress(analyzeId, 100, "Analysis complete!", undefined);

    // Return analysis results
    return NextResponse.json({
      success: true,
      analysis,
      frameUrl: `data:image/jpeg;base64,${frameBase64}`,
    });
  } catch (error) {
    console.error("Video analysis error:", error);
    const errorMessage = (error as Error).message;
    setUploadProgress(analyzeId, 0, "Analysis failed", errorMessage);
    return NextResponse.json(
      { error: "Failed to analyze video", details: errorMessage },
      { status: 500 }
    );
  }
}
