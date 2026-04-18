import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "./instance";
import { markRecentAuth } from "./recent-auth";
import { verifyPassword } from "./password";
import { getDb } from "../server/db/client";
import { account as accountTable } from "../server/db/schema";
import { childLogger } from "../server/logger";

export type RecentAuthReverifyResult = { ok: true } | { ok: false; reason: "no-session" | "no-credential" | "invalid-password" };

// Re-verify the current user's password and, on success, refresh the
// `lastAuthenticatedAt` marker on their session. This is the server
// action behind the `/account/recent-auth` prompt: UI pages that gate
// sensitive auth-management actions call it when the user provides
// their password again to re-enter the elevated window.
//
// We intentionally do not rotate the session cookie here — the
// identity has not changed, only the marker. Callers must still treat
// the resulting elevation as short-lived via `verifyRecentAuth`.
export async function reverifyPasswordForRecentAuth(password: string): Promise<RecentAuthReverifyResult> {
  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.session || !session.user) {
    return { ok: false, reason: "no-session" };
  }

  const db = getDb();
  const credentialAccount = await db
    .select({ password: accountTable.password })
    .from(accountTable)
    .where(and(eq(accountTable.userId, session.user.id), eq(accountTable.providerId, "credential")))
    .limit(1);

  const hashed = credentialAccount[0]?.password;
  if (!hashed) {
    // Passkey-only or OAuth-only accounts do not have a credential row
    // to re-verify against. The UI prompts a different flow (passkey
    // re-verification) for those users, so this branch is hit only when
    // a caller misroutes a password prompt.
    return { ok: false, reason: "no-credential" };
  }

  const ok = await verifyPassword(password, hashed);
  if (!ok) {
    childLogger({ component: "auth.recent-auth" }).info({ userId: session.user.id }, "recent-auth password verification failed");
    return { ok: false, reason: "invalid-password" };
  }

  await markRecentAuth(session.session.id);
  return { ok: true };
}
