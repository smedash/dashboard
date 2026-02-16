import { NextRequest, NextResponse } from "next/server";

/**
 * Edge-compatible middleware that checks for session cookie presence.
 *
 * We can't use auth() from NextAuth here because it uses PrismaAdapter
 * which requires Node.js runtime (not Edge). Instead, we check for the
 * session cookie as a lightweight gate. The actual session validation
 * still happens in API routes and server components via auth().
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // NextAuth v5 session cookie names
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  const isLoggedIn = !!sessionToken;

  const isAuthRoute = pathname.startsWith("/api/auth");
  const isCronRoute = pathname.startsWith("/api/cron");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname === "/robots.txt";
  const isLoginPage =
    pathname === "/login" ||
    pathname === "/verify" ||
    pathname.startsWith("/auth-confirm");

  if (isAuthRoute || isCronRoute || isPublicAsset) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|briefing-vorlage\\.docx|seo-checkliste\\.xlsx|.*\\.svg).*)",
  ],
};
