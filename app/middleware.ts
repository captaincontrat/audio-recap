import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";

// The middleware runs on the Edge runtime and therefore cannot import the
// Node-only Better Auth instance, its database adapter, or anything marked
// `server-only`. We perform a fast, cookie-presence pre-check here so
// unauthenticated visitors are bounced to the sign-in screen without
// spending database roundtrips, and defer full verification-state checks to
// Server Components and API route handlers where the Node runtime is
// available.

const SIGN_IN_PATH = "/sign-in";

const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/meetings", "/account"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSessionCookie) {
    return NextResponse.next();
  }

  const signInUrl = new URL(SIGN_IN_PATH, request.url);
  signInUrl.searchParams.set("from", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  // Exclude Next.js internals and the public asset folder so static
  // responses skip the middleware hop.
  matcher: ["/((?!_next|api/auth|favicon.ico|.*\\..*).*)"],
};
