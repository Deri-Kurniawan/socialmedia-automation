import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { account, integrationAccount, uploadHistory } from "@/lib/db/schema";
import { setUploadProgress } from "../upload-progress/route";

// YouTube Category ID to Name mapping
const YOUTUBE_CATEGORIES: Record<string, string> = {
  "1": "Film & Animation",
  "2": "Autos & Vehicles",
  "10": "Music",
  "15": "Pets & Animals",
  "17": "Sports",
  "19": "Travel & Events",
  "20": "Gaming",
  "22": "People & Blogs",
  "23": "Comedy",
  "24": "Entertainment",
  "25": "News & Politics",
  "26": "Howto & Style",
  "27": "Education",
  "28": "Science & Technology",
};

function getCategoryName(categoryId: string): string {
  return YOUTUBE_CATEGORIES[categoryId] || "People & Blogs";
}

// Google OAuth token refresh endpoint
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return null;
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

// Get valid access token for a specific integration (refresh if expired)
async function getValidAccessTokenForIntegration(
  integration: typeof integrationAccount.$inferSelect
): Promise<{ token: string; integrationId: string } | null> {
  if (!integration.accessToken) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date();
  const expiresAt = integration.accessTokenExpiresAt;
  const isExpired = !expiresAt || new Date(expiresAt.getTime() - 5 * 60 * 1000) < now;

  if (!isExpired) {
    return { token: integration.accessToken, integrationId: integration.id };
  }

  // Token expired, try to refresh
  if (!integration.refreshToken) {
    console.error("No refresh token available for integration:", integration.id);
    return null;
  }

  console.log("Refreshing expired access token for integration:", integration.id);
  const refreshed = await refreshAccessToken(integration.refreshToken);

  if (!refreshed) {
    return null;
  }

  // Update the integration account with new access token
  const newExpiresAt = new Date(now.getTime() + refreshed.expires_in * 1000);
  await db.update(integrationAccount).set({
    accessToken: refreshed.access_token,
    accessTokenExpiresAt: newExpiresAt,
    updatedAt: now,
  }).where(eq(integrationAccount.id, integration.id));

  console.log("Access token refreshed successfully, expires at:", newExpiresAt);
  return { token: refreshed.access_token, integrationId: integration.id };
}

// Get integration by ID or return default integration for user
async function getYouTubeIntegration(
  userId: string,
  integrationId?: string
): Promise<typeof integrationAccount.$inferSelect | null> {
  if (integrationId) {
    // Get specific integration
    const integration = await db.query.integrationAccount.findFirst({
      where: and(
        eq(integrationAccount.id, integrationId),
        eq(integrationAccount.userId, userId),
        eq(integrationAccount.platform, "youtube"),
        eq(integrationAccount.isActive, true)
      ),
    });
    if (integration) return integration;
  }

  // Get default integration
  const defaultIntegration = await db.query.integrationAccount.findFirst({
    where: and(
      eq(integrationAccount.userId, userId),
      eq(integrationAccount.platform, "youtube"),
      eq(integrationAccount.isActive, true),
      eq(integrationAccount.isDefault, true)
    ),
  });

  if (defaultIntegration) return defaultIntegration;

  // Get any active integration as fallback
  const anyIntegration = await db.query.integrationAccount.findFirst({
    where: and(
      eq(integrationAccount.userId, userId),
      eq(integrationAccount.platform, "youtube"),
      eq(integrationAccount.isActive, true)
    ),
  });

  return anyIntegration;
}

// Legacy function - kept for compatibility but uses new approach
async function getValidAccessToken(
  userId: string, 
  userEmail?: string,
  requestedIntegrationId?: string
): Promise<{ token: string; integrationId: string } | null> {
  const integration = await getYouTubeIntegration(userId, requestedIntegrationId || undefined);
  
  if (!integration) {
    return null;
  }

  return getValidAccessTokenForIntegration(integration);
}

// YouTube upload function using resumable upload protocol
async function uploadToYouTube(
  accessToken: string,
  videoBuffer: Buffer,
  metadata: {
    title: string;
    description: string;
    tags: string[];
    privacyStatus: string;
    categoryId: string;
  },
  uploadId: string
) {
  const uploadUrl = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,contentDetails";

  // Step 1: Initialize resumable upload session
  setUploadProgress(uploadId, 5, "Initializing upload...");
  
  const initResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Length": videoBuffer.length.toString(),
      "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify({
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  if (!initResponse.ok) {
    const error = await initResponse.json();
    throw new Error(`Failed to initialize upload: ${JSON.stringify(error)}`);
  }

  const uploadSessionUrl = initResponse.headers.get("Location");
  if (!uploadSessionUrl) {
    throw new Error("No upload session URL received");
  }

  // Step 2: Upload video content in chunks for progress tracking
  setUploadProgress(uploadId, 10, "Starting video upload...");
  
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  const totalSize = videoBuffer.length;
  let uploaded = 0;

  while (uploaded < totalSize) {
    const chunk = videoBuffer.slice(uploaded, uploaded + chunkSize);
    const chunkEnd = Math.min(uploaded + chunk.length - 1, totalSize - 1);

    const uploadResponse = await fetch(uploadSessionUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "video/mp4",
        "Content-Range": `bytes ${uploaded}-${chunkEnd}/${totalSize}`,
      },
      body: chunk,
    });

    if (!uploadResponse.ok && uploadResponse.status !== 308) {
      const error = await uploadResponse.json();
      throw new Error(`Upload failed: ${JSON.stringify(error)}`);
    }

    uploaded += chunk.length;
    const progress = Math.round(10 + ((uploaded / totalSize) * 85)); // 10% to 95%
    setUploadProgress(uploadId, progress, `Uploading video... ${progress}%`);

    // If upload is complete (201 Created), return the video data
    if (uploadResponse.status === 201 || uploadResponse.status === 200) {
      setUploadProgress(uploadId, 95, "Processing on YouTube...");
      return await uploadResponse.json();
    }
  }

  throw new Error("Upload incomplete");
}

export async function POST(request: NextRequest) {
  const uploadId = request.headers.get("X-Upload-Id");
  
  if (!uploadId) {
    return NextResponse.json({ error: "Missing upload ID" }, { status: 400 });
  }

  // Declare variables at top level so they're accessible in catch block
  let formData: FormData;
  let title = "";
  let description = "";
  let tags: string[] = [];
  let privacyStatus = "public";
  let categoryId = "22";
  let videoFile: File | null = null;
  let session: { user: { id: string; email?: string } } | null = null;

  try {
    // Check authentication
    const sessionData = await auth.api.getSession({ headers: await headers() });
    if (!sessionData) {
      setUploadProgress(uploadId, 0, "Authentication failed", "Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    session = sessionData as { user: { id: string; email?: string } };

    // Parse form data
    formData = await request.formData();
    videoFile = formData.get("video") as File;
    title = formData.get("title") as string;
    description = formData.get("description") as string;
    const tagsJson = formData.get("tags") as string;
    privacyStatus = formData.get("privacyStatus") as string;
    categoryId = formData.get("categoryId") as string;
    const requestedIntegrationId = formData.get("integrationId") as string;

    if (!videoFile) {
      setUploadProgress(uploadId, 0, "No video file", "No video file provided");
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    // Parse and validate tags - TOTAL 500 char limit
    tags = JSON.parse(tagsJson || "[]") as string[];
    const totalTagChars = tags.join("").length;
    const MAX_TAGS_TOTAL = 500;
    
    if (totalTagChars > MAX_TAGS_TOTAL) {
      setUploadProgress(uploadId, 0, "Tags too long", `Tags exceed ${MAX_TAGS_TOTAL} character limit`);
      return NextResponse.json({ 
        error: `Tags exceed ${MAX_TAGS_TOTAL} character limit`, 
        details: `Current: ${totalTagChars} chars` 
      }, { status: 400 });
    }

    setUploadProgress(uploadId, 3, "Reading video file...");

    // Get valid (possibly refreshed) access token and integration account
    setUploadProgress(uploadId, 4, "Checking YouTube authentication...");
    
    // Use requested integration if provided, otherwise get default
    let authData: { token: string; integrationId: string } | null = null;
    
    // Get the integration (specific or default)
    const integration = await getYouTubeIntegration(session!.user.id, requestedIntegrationId || undefined);
    
    if (integration) {
      // Get valid access token (with refresh if needed) for this integration
      authData = await getValidAccessTokenForIntegration(integration);
    }

    if (!authData) {
      setUploadProgress(uploadId, 0, "YouTube not connected", "YouTube account not connected or token expired. Please log out and log back in.");
      return NextResponse.json({ 
        error: "YouTube account not connected or token expired", 
        details: "Please log out and log back in to refresh your YouTube connection." 
      }, { status: 401 });
    }

    const { token: accessToken, integrationId } = authData;

    setUploadProgress(uploadId, 5, "Starting YouTube upload...");

    // Convert file to buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

    // Upload to YouTube with progress tracking
    const result = await uploadToYouTube(
      accessToken,
      videoBuffer,
      { title, description, tags, privacyStatus, categoryId },
      uploadId
    );

    setUploadProgress(uploadId, 100, "Upload complete!", undefined);

    // Save upload history to database
    const contentUrl = `https://youtube.com/watch?v=${result.id}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${result.id}/mqdefault.jpg`;
    
    try {
      await db.insert(uploadHistory).values({
        id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: session!.user.id,
        integrationAccountId: integrationId,
        platform: "youtube",
        externalId: result.id,
        title: title.substring(0, 100),
        description: description?.substring(0, 5000) || null,
        tags: JSON.stringify(tags),
        privacyStatus,
        categoryId,
        categoryName: getCategoryName(categoryId),
        contentUrl,
        thumbnailUrl,
        status: "completed",
        fileSize: videoBuffer.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (dbError) {
      console.error("Failed to save upload history:", dbError);
      // Don't fail the upload if history save fails
    }

    return NextResponse.json({
      success: true,
      videoId: result.id,
      videoUrl: contentUrl,
    });
  } catch (error) {
    console.error("YouTube upload error:", error);
    const errorMessage = (error as Error).message;
    setUploadProgress(uploadId, 0, "Upload failed", errorMessage);
    
    // Save failed upload to history (only if we have session and form data)
    if (session) {
      try {
        await db.insert(uploadHistory).values({
          id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          userId: session.user.id,
          integrationAccountId: null, // Failed before getting integration
          platform: "youtube",
          externalId: "failed",
          title: (title || "Untitled").substring(0, 100),
          description: description?.substring(0, 5000) || null,
          tags: JSON.stringify(tags.length > 0 ? tags : []),
          privacyStatus: privacyStatus || "public",
          categoryId: categoryId || "22",
          categoryName: getCategoryName(categoryId || "22"),
          contentUrl: "",
          thumbnailUrl: null,
          status: "failed",
          errorMessage: errorMessage?.substring(0, 500),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (dbError) {
        console.error("Failed to save failed upload history:", dbError);
      }
    }
    
    return NextResponse.json({ error: "Failed to upload video", details: errorMessage }, { status: 500 });
  }
}
