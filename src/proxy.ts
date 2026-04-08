import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that don't require authentication
const publicPaths = ["/login", "/api/auth"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is public
  const isPublicPath = publicPaths.some(
    (path) => pathname.startsWith(path) || pathname === "/"
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // For protected routes, the session check will be handled by the layout/page
  // This proxy just ensures API routes are handled correctly
  if (pathname.startsWith("/api/")) {
    // API routes should be handled by their own auth checks
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
