import { db } from "@/lib/db";
import { integrationAccount } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

// Exchange code for tokens
async function exchangeCodeForTokens(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/youtube/callback`;

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

// Get user info from Google
async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to get user info");
  }

  return await response.json();
}

// Get YouTube channels for the user
async function getYouTubeChannels(accessToken: string) {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch YouTube channels");
  }

  const data = await response.json();
  return data.items || [];
}

// Handle YouTube OAuth callback
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const stateParam = searchParams.get("state");

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(new URL("/dashboard/integrations?error=oauth_denied", request.url));
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid_request", request.url));
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(stateParam, "base64").toString());
    } catch {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid_state", request.url));
    }

    const { userId, redirect, switchAccount } = stateData;

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens(code);
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Calculate expiration time
    const accessTokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Get Google user info (to get the Google account ID and email)
    const googleUserInfo = await getGoogleUserInfo(access_token);
    const googleAccountId = googleUserInfo.id;
    const googleAccountEmail = googleUserInfo.email;

    // Get YouTube channels
    const channels = await getYouTubeChannels(access_token);

    if (channels.length === 0) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=no_channels", request.url)
      );
    }

    // Store tokens in the database for each channel
    // If multiple channels, we'll need to show a picker, but for now connect the first one
    // or update existing ones with new tokens
    for (const channel of channels) {
      const channelId = channel.id;
      const channelName = channel.snippet?.title || "YouTube Channel";
      const channelHandle = channel.snippet?.customUrl || null;
      const metadata = JSON.stringify({
        thumbnail: channel.snippet?.thumbnails?.default?.url,
        description: channel.snippet?.description,
      });

      // Check if this integration already exists
      const existingIntegration = await db.query.integrationAccount.findFirst({
        where: and(
          eq(integrationAccount.userId, userId),
          eq(integrationAccount.platform, "youtube"),
          eq(integrationAccount.externalAccountId, channelId)
        ),
      });

      if (existingIntegration) {
        // Update existing integration with new tokens
        await db
          .update(integrationAccount)
          .set({
            accessToken: access_token,
            refreshToken: refresh_token,
            accessTokenExpiresAt,
            scope,
            googleAccountId,
            googleAccountEmail,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(integrationAccount.id, existingIntegration.id));
      } else {
        // Create new integration
        // Check if this is the first YouTube integration for default status
        const hasExistingYouTube = await db.query.integrationAccount.findFirst({
          where: and(
            eq(integrationAccount.userId, userId),
            eq(integrationAccount.platform, "youtube"),
            eq(integrationAccount.isActive, true)
          ),
        });

        const newIntegrationId = `yt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await db.insert(integrationAccount).values({
          id: newIntegrationId,
          userId,
          platform: "youtube",
          externalAccountId: channelId,
          name: channelName,
          handle: channelHandle,
          googleAccountId,
          googleAccountEmail,
          accessToken: access_token,
          refreshToken: refresh_token,
          accessTokenExpiresAt,
          scope,
          metadata,
          isActive: true,
          isDefault: !hasExistingYouTube,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Redirect back to integrations page
    const redirectUrl = new URL(redirect, request.url);
    if (channels.length === 1) {
      redirectUrl.searchParams.set("connected", "true");
      redirectUrl.searchParams.set("channel", channels[0].snippet?.title || "Channel");
    } else {
      redirectUrl.searchParams.set("multiple", "true");
      redirectUrl.searchParams.set("count", channels.length.toString());
    }

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("Error in YouTube OAuth callback:", error);
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=callback_failed", request.url)
    );
  }
}
