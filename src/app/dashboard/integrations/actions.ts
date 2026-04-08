"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { account, integrationAccount } from "@/lib/db/schema";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export interface Integration {
  id: string;
  platform: string;
  name: string;
  handle: string | null;
  isActive: boolean;
  isDefault: boolean;
  googleAccountId: string | null;
  googleAccountEmail: string | null;
  metadata: {
    thumbnail?: string;
    description?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleAccount {
  accountId: string;
  email: string | null;
  channelCount: number;
  channels: Integration[];
}

export interface YouTubeChannel {
  id: string;
  name: string;
  handle: string | null;
  thumbnail: string | null;
  description: string | null;
  connectionCount?: number; // Number of existing connections to this channel
}

// Optimized version that accepts userId directly (avoids double auth check)
export async function getIntegrationsForUser(userId: string): Promise<{
  success: boolean;
  integrations?: Integration[];
  error?: string;
}> {
  try {
    const integrations = await db.query.integrationAccount.findMany({
      where: eq(integrationAccount.userId, userId),
      orderBy: (ia, { desc }) => [desc(ia.createdAt)],
    });

    // Parse metadata JSON for each integration and exclude sensitive data
    const formattedIntegrations: Integration[] = integrations.map((integration) => ({
      id: integration.id,
      platform: integration.platform,
      name: integration.name,
      handle: integration.handle,
      isActive: integration.isActive,
      isDefault: integration.isDefault,
      googleAccountId: integration.googleAccountId,
      googleAccountEmail: integration.googleAccountEmail,
      metadata: integration.metadata ? JSON.parse(integration.metadata) : null,
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
    }));

    return { success: true, integrations: formattedIntegrations };
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return { success: false, error: "Failed to fetch integrations" };
  }
}

// Legacy version with auth check (for client-side calls)
export async function getIntegrations(): Promise<{
  success: boolean;
  integrations?: Integration[];
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    return getIntegrationsForUser(session.user.id);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return { success: false, error: "Failed to fetch integrations" };
  }
}

// Optimized version that accepts userId directly
export async function getIntegrationsByGoogleAccountForUser(userId: string): Promise<{
  success: boolean;
  accounts?: GoogleAccount[];
  ungrouped?: Integration[];
  error?: string;
}> {
  try {
    const integrations = await db.query.integrationAccount.findMany({
      where: eq(integrationAccount.userId, userId),
      orderBy: (ia, { desc }) => [desc(ia.createdAt)],
    });

    // Group integrations by googleAccountId
    const grouped = new Map<string, Integration[]>();
    const ungrouped: Integration[] = [];

    for (const integration of integrations) {
      const formatted: Integration = {
        id: integration.id,
        platform: integration.platform,
        name: integration.name,
        handle: integration.handle,
        isActive: integration.isActive,
        isDefault: integration.isDefault,
        googleAccountId: integration.googleAccountId,
        googleAccountEmail: integration.googleAccountEmail,
        metadata: integration.metadata ? JSON.parse(integration.metadata) : null,
        createdAt: integration.createdAt.toISOString(),
        updatedAt: integration.updatedAt.toISOString(),
      };

      if (integration.googleAccountId) {
        const existing = grouped.get(integration.googleAccountId) || [];
        existing.push(formatted);
        grouped.set(integration.googleAccountId, existing);
      } else {
        ungrouped.push(formatted);
      }
    }

    // Build GoogleAccount array
    const accounts: GoogleAccount[] = [];
    for (const [accountId, channels] of grouped) {
      // Get email from first channel
      const email = channels[0]?.googleAccountEmail || null;
      accounts.push({
        accountId,
        email,
        channelCount: channels.length,
        channels: channels.filter(c => c.isActive),
      });
    }

    // Sort by email
    accounts.sort((a, b) => (a.email || "").localeCompare(b.email || ""));

    return { success: true, accounts, ungrouped: ungrouped.filter(i => i.isActive) };
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return { success: false, error: "Failed to fetch integrations" };
  }
}

// Legacy version with auth check (for client-side calls)
export async function getIntegrationsByGoogleAccount(): Promise<{
  success: boolean;
  accounts?: GoogleAccount[];
  ungrouped?: Integration[];
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    return getIntegrationsByGoogleAccountForUser(session.user.id);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return { success: false, error: "Failed to fetch integrations" };
  }
}

// Fetch ALL YouTube channels for the specified integration tokens
// NOTE: This requires an integration with valid tokens, not the login session
export async function getYouTubeChannels(integrationId?: string): Promise<{
  success: boolean;
  channels?: YouTubeChannel[];
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Get access token from integration (not from login session)
    let accessToken: string | null = null;

    if (integrationId) {
      // Use specific integration's token
      const integration = await db.query.integrationAccount.findFirst({
        where: and(
          eq(integrationAccount.id, integrationId),
          eq(integrationAccount.userId, session.user.id),
          eq(integrationAccount.isActive, true)
        ),
      });
      accessToken = integration?.accessToken || null;
    } else {
      // Use any active integration's token
      const integration = await db.query.integrationAccount.findFirst({
        where: and(
          eq(integrationAccount.userId, session.user.id),
          eq(integrationAccount.platform, "youtube"),
          eq(integrationAccount.isActive, true)
        ),
      });
      accessToken = integration?.accessToken || null;
    }

    if (!accessToken) {
      return { success: false, error: "No YouTube integration found. Please connect a YouTube channel first." };
    }

    // Fetch ALL YouTube channels (up to 50) - includes brand accounts
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      return { success: false, error: "Failed to fetch YouTube channels" };
    }

    const data = await response.json();
    const items = data.items || [];

    // Get already connected channel IDs and their connection count
    const existingIntegrations = await db.query.integrationAccount.findMany({
      where: and(
        eq(integrationAccount.userId, session.user.id),
        eq(integrationAccount.platform, "youtube"),
        eq(integrationAccount.isActive, true)
      ),
    });
    
    // Count connections per channel
    const connectionCounts = new Map<string, number>();
    for (const integration of existingIntegrations) {
      const count = connectionCounts.get(integration.externalAccountId) || 0;
      connectionCounts.set(integration.externalAccountId, count + 1);
    }

    // Map to our format - show ALL channels including already connected ones
    // Add connection count info to each channel
    const channels: YouTubeChannel[] = items.map((item: any) => ({
      id: item.id,
      name: item.snippet?.title || "YouTube Channel",
      handle: item.snippet?.customUrl || null,
      thumbnail: item.snippet?.thumbnails?.default?.url || null,
      description: item.snippet?.description || null,
      connectionCount: connectionCounts.get(item.id) || 0,
    }));

    return { success: true, channels };
  } catch (error) {
    console.error("Error fetching YouTube channels:", error);
    return { success: false, error: "Failed to fetch channels" };
  }
}

// Connect a specific YouTube channel using integration-specific OAuth tokens
// NOTE: Tokens come from the integration OAuth flow (not login session)
// This allows tokens to be shared with other users who connect to the same channel
export async function connectYouTubeChannel(
  channelId: string,
  integrationTokens: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    scope: string;
    googleAccountId: string;
    googleAccountEmail: string;
  }
): Promise<{
  success: boolean;
  action?: "connected";
  integration?: Omit<Integration, "createdAt" | "updatedAt">;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Fetch specific channel info using the integration tokens
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&maxResults=1`,
      { headers: { Authorization: `Bearer ${integrationTokens.accessToken}` } }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      return { success: false, error: "Failed to fetch YouTube channel" };
    }

    const data = await response.json();
    const channel = data.items?.[0];

    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    const fetchedChannelId = channel.id;
    const channelName = channel.snippet?.title || "YouTube Channel";
    const channelHandle = channel.snippet?.customUrl || null;
    const metadata = JSON.stringify({
      thumbnail: channel.snippet?.thumbnails?.default?.url,
      description: channel.snippet?.description,
    });

    // Check if any existing integrations for default status
    const hasExistingYouTube = await db.query.integrationAccount.findFirst({
      where: and(
        eq(integrationAccount.userId, session.user.id),
        eq(integrationAccount.platform, "youtube"),
        eq(integrationAccount.isActive, true)
      ),
    });

    // ALWAYS create a new integration - allows multiple connections to same channel
    // Tokens are stored per-integration and can be shared
    const newIntegrationId = `yt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await db.insert(integrationAccount).values({
      id: newIntegrationId,
      userId: session.user.id,
      platform: "youtube",
      externalAccountId: fetchedChannelId,
      name: channelName,
      handle: channelHandle,
      googleAccountId: integrationTokens.googleAccountId,
      googleAccountEmail: integrationTokens.googleAccountEmail,
      accessToken: integrationTokens.accessToken,
      refreshToken: integrationTokens.refreshToken,
      accessTokenExpiresAt: integrationTokens.expiresAt,
      scope: integrationTokens.scope,
      metadata,
      isActive: true,
      isDefault: !hasExistingYouTube,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath("/dashboard/integrations");

    return {
      success: true,
      action: "connected",
      integration: {
        id: newIntegrationId,
        platform: "youtube",
        name: channelName,
        handle: channelHandle,
        googleAccountId: integrationTokens.googleAccountId,
        googleAccountEmail: integrationTokens.googleAccountEmail,
        metadata: JSON.parse(metadata),
        isActive: true,
        isDefault: !hasExistingYouTube,
      },
    };
  } catch (error) {
    console.error("Error connecting channel:", error);
    return { success: false, error: "Failed to connect channel" };
  }
}

// Legacy connect function - now redirects to channel selection
export async function connectIntegration(platform: string): Promise<{
  success: boolean;
  action?: "connected" | "reconnected";
  integration?: Omit<Integration, "createdAt" | "updatedAt">;
  error?: string;
}> {
  // This is now deprecated - use getYouTubeChannels and connectYouTubeChannel instead
  return { success: false, error: "Use getYouTubeChannels and connectYouTubeChannel instead" };
}

export async function disconnectIntegration(integrationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify the integration belongs to the user
    const integration = await db.query.integrationAccount.findFirst({
      where: and(
        eq(integrationAccount.id, integrationId),
        eq(integrationAccount.userId, session.user.id)
      ),
    });

    if (!integration) {
      return { success: false, error: "Integration not found" };
    }

    // Soft delete by marking as inactive and clearing tokens
    await db
      .update(integrationAccount)
      .set({
        isActive: false,
        accessToken: null,
        refreshToken: null,
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(eq(integrationAccount.id, integrationId));

    // If this was the default, set another active integration as default
    if (integration.isDefault) {
      const anotherIntegration = await db.query.integrationAccount.findFirst({
        where: and(
          eq(integrationAccount.userId, session.user.id),
          eq(integrationAccount.platform, integration.platform),
          eq(integrationAccount.isActive, true)
        ),
      });

      if (anotherIntegration) {
        await db
          .update(integrationAccount)
          .set({ isDefault: true })
          .where(eq(integrationAccount.id, anotherIntegration.id));
      }
    }

    revalidatePath("/dashboard/integrations");
    return { success: true };
  } catch (error) {
    console.error("Error disconnecting integration:", error);
    return { success: false, error: "Failed to disconnect integration" };
  }
}

export async function setDefaultIntegration(
  integrationId: string,
  platform: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // First, unset default for all integrations of this platform
    await db
      .update(integrationAccount)
      .set({ isDefault: false })
      .where(
        and(
          eq(integrationAccount.userId, session.user.id),
          eq(integrationAccount.platform, platform)
        )
      );

    // Set the selected integration as default
    await db
      .update(integrationAccount)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(integrationAccount.id, integrationId),
          eq(integrationAccount.userId, session.user.id)
        )
      );

    revalidatePath("/dashboard/integrations");
    return { success: true };
  } catch (error) {
    console.error("Error setting default integration:", error);
    return { success: false, error: "Failed to update integration" };
  }
}
