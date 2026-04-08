import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { cache } from "react";
import { headers } from "next/headers";

// Login scopes - minimal, just for authentication
const loginScopes = [
  "openid",
  "email",
  "profile",
];

// Integration scopes - full YouTube permissions (used separately from login)
export const youtubeIntegrationScopes = [
  // Core YouTube Data API scopes
  "https://www.googleapis.com/auth/youtube", // Full YouTube account management
  "https://www.googleapis.com/auth/youtube.readonly", // Read-only access
  "https://www.googleapis.com/auth/youtube.upload", // Upload videos
  "https://www.googleapis.com/auth/youtube.force-ssl", // Edit videos, ratings, comments, captions
  "https://www.googleapis.com/auth/youtube.channel-memberships.creator", // Channel memberships
  "https://www.googleapis.com/auth/youtubepartner", // View and manage assets
  "https://www.googleapis.com/auth/youtubepartner-channel-audit", // Channel audit

  // YouTube Analytics API scopes
  "https://www.googleapis.com/auth/yt-analytics.readonly", // View YouTube Analytics
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly", // Monetary analytics

  // Standard OAuth scopes
  "openid",
  "email",
  "profile",
];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Login uses minimal scopes - integration will use separate OAuth flow
      scope: loginScopes,
      // Request offline access to get a refresh token
      accessType: "offline",
      prompt: "consent",
    },
  },
  session: {
    // Secure cookie settings
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    // Cookie configuration for OAuth state verification
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",
});

export type Auth = typeof auth;

// Cached session getter to dedupe calls within the same request
// This prevents multiple DB hits when both layout and page need the session
export const getSessionCached = cache(async () => {
  return await auth.api.getSession({ headers: await headers() });
});
