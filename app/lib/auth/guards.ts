import "server-only";

import { getSessionFromHeaders, type SessionContext } from "./session";

export type GuardOutcome =
  | { status: "authenticated"; context: SessionContext }
  | { status: "unauthenticated"; redirectTo: string }
  | { status: "unverified"; context: SessionContext; redirectTo: string };

export type GuardOptions = {
  signInPath?: string;
  verifyEmailPath?: string;
};

const DEFAULT_SIGN_IN_PATH = "/sign-in";
const DEFAULT_VERIFY_EMAIL_PATH = "/verify-email";

// Decision helper shared by middleware, Server Components, and API route
// handlers. It distinguishes "no session" from "session present but email
// unverified" so callers can route the user to the right flow — the spec
// explicitly requires this separation for protected surfaces.
export async function evaluateProtectedRoute(headers: Headers, options: GuardOptions = {}): Promise<GuardOutcome> {
  const signInPath = options.signInPath ?? DEFAULT_SIGN_IN_PATH;
  const verifyEmailPath = options.verifyEmailPath ?? DEFAULT_VERIFY_EMAIL_PATH;

  const context = await getSessionFromHeaders(headers);
  if (!context) {
    return { status: "unauthenticated", redirectTo: signInPath };
  }
  if (!context.user.emailVerified) {
    return { status: "unverified", context, redirectTo: verifyEmailPath };
  }
  return { status: "authenticated", context };
}

// Convenience wrapper for JSON API handlers. Returns a response-friendly
// outcome with HTTP status codes so handlers can pipe the result straight
// into `Response` objects without re-deriving the mapping each time.
export type ApiGuardOutcome =
  | { ok: true; context: SessionContext }
  | { ok: false; status: 401 | 403; code: "unauthenticated" | "email_unverified"; message: string };

export async function evaluateProtectedApiRequest(headers: Headers): Promise<ApiGuardOutcome> {
  const outcome = await evaluateProtectedRoute(headers);
  switch (outcome.status) {
    case "authenticated":
      return { ok: true, context: outcome.context };
    case "unauthenticated":
      return {
        ok: false,
        status: 401,
        code: "unauthenticated",
        message: "Authentication required.",
      };
    case "unverified":
      return {
        ok: false,
        status: 403,
        code: "email_unverified",
        message: "Verify your email to continue.",
      };
  }
}
