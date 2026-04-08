import { NextResponse } from "next/server";

/**
 * This endpoint handles direct access to /api/auth/google
 * which users might try to access manually.
 * 
 * It redirects to the correct Better Auth social sign-in flow
 * or returns helpful information about the proper API usage.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get("prompt");
  
  // If someone is trying to force account selection via URL params,
  // we can't directly support this with Better Auth's current API,
  // but we can guide them to the correct approach.
  
  if (prompt?.includes("select_account")) {
    // Redirect to the integrations page with a query param
    // that the frontend can use to show guidance
    return NextResponse.redirect(
      new URL("/dashboard/integrations?showAccountHelp=true", request.url)
    );
  }

  // Default: redirect to login page
  return NextResponse.redirect(
    new URL("/login", request.url)
  );
}
