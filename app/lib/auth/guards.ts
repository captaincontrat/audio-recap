import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { user as userTable } from "../server/db/schema";
import { revokeSessionsForUser } from "./accounts";
import { getSessionFromHeaders, type SessionContext } from "./session";

export type GuardOutcome =
  | { status: "authenticated"; context: SessionContext }
  | { status: "unauthenticated"; redirectTo: string }
  | { status: "unverified"; context: SessionContext; redirectTo: string }
  | { status: "closed"; context: SessionContext; redirectTo: string };

export type GuardOptions = {
  signInPath?: string;
  verifyEmailPath?: string;
  accountClosedPath?: string;
};

const DEFAULT_SIGN_IN_PATH = "/sign-in";
const DEFAULT_VERIFY_EMAIL_PATH = "/verify-email";
const DEFAULT_ACCOUNT_CLOSED_PATH = "/account/closed";

// Decision helper shared by middleware, Server Components, and API route
// handlers. It distinguishes "no session" from "session present but email
// unverified" from "session belongs to a closed account" so callers can
// route the user to the right flow — the spec explicitly requires these
// separations for protected surfaces. A closed account still has a valid
// session cookie (the closure flow revokes sessions, but a lingering
// cookie can race past the DB write), so this guard short-circuits
// normal authenticated access and revokes the session in-flight.
export async function evaluateProtectedRoute(headers: Headers, options: GuardOptions = {}): Promise<GuardOutcome> {
  const signInPath = options.signInPath ?? DEFAULT_SIGN_IN_PATH;
  const verifyEmailPath = options.verifyEmailPath ?? DEFAULT_VERIFY_EMAIL_PATH;
  const accountClosedPath = options.accountClosedPath ?? DEFAULT_ACCOUNT_CLOSED_PATH;

  const context = await getSessionFromHeaders(headers);
  if (!context) {
    return { status: "unauthenticated", redirectTo: signInPath };
  }

  // Account-closure retention: a closed account must not reach any
  // authenticated surface during the reactivation window. We check the
  // live `user.closed_at` column rather than trusting the session
  // snapshot so a freshly-closed account is refused immediately on the
  // next request, without waiting for a session cache roll-over.
  const closureRow = await getDb().select({ closedAt: userTable.closedAt }).from(userTable).where(eq(userTable.id, context.user.id)).limit(1);
  if (closureRow[0]?.closedAt) {
    await revokeSessionsForUser({ userId: context.user.id }).catch(() => {});
    return { status: "closed", context, redirectTo: accountClosedPath };
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
  | { ok: false; status: 401 | 403; code: "unauthenticated" | "email_unverified" | "account_closed"; message: string };

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
    case "closed":
      return {
        ok: false,
        status: 401,
        code: "account_closed",
        message: "This account is closed.",
      };
  }
}
