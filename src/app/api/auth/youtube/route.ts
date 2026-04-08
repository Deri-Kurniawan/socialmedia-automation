import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { youtubeIntegrationScopes } from "@/lib/auth";

// Initiate YouTube integration OAuth flow
// This is SEPARATE from login OAuth - it requests full YouTube permissions
export async function GET(request: Request) {
  try {
    // Check if user is logged in
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { searchParams } = new URL(request.url);
    const redirectUrl = searchParams.get("redirect") || "/dashboard/integrations";
    const switchAccount = searchParams.get("switchAccount") === "true";

    // Build Google OAuth URL with full YouTube scopes
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    
    const stateData = {
      userId: session.user.id,
      redirect: redirectUrl,
      switchAccount,
      timestamp: Date.now(),
    };
    
    // Encode state as base64
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", `${baseUrl}/api/auth/youtube/callback`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", youtubeIntegrationScopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", switchAccount ? "consent select_account" : "consent");
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating YouTube OAuth:", error);
    return NextResponse.redirect(new URL("/dashboard/integrations?error=oauth_failed", request.url));
  }
}
