import "server-only";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/instance";
import { verifyRecentAuth } from "@/lib/auth/recent-auth";
import { childLogger } from "@/lib/server/logger";
import { reactivateAccount } from "./closure";
import { AccountNotFoundError, AccountNotReactivatableError } from "./errors";

export type ReactivateAccountActionResult = { ok: true } | { ok: false; reason: "no-session" | "not-closed" | "window-expired" | "fresh-auth-required" };

// Server action behind the `/account/closed` reactivation button. V1
// reactivation requires the user to have already completed a fresh
// sign-in (primary + fresh second-factor verification when 2FA is
// enabled). Better Auth's session-create hook stamps `lastAuthenticatedAt`
// at the moment a new session row lands — for a 2FA-enabled account that
// only happens after the second-factor challenge — so a recent
// `lastAuthenticatedAt` is proof that both prerequisites are met for
// this reactivation attempt.
//
// The caller's session cookie is what we inspect; we never trust URL
// parameters or cached client state to decide reactivation.
export async function reactivateCurrentAccount(): Promise<ReactivateAccountActionResult> {
  const log = childLogger({ component: "accounts.reactivate" });
  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.session || !session.user) {
    return { ok: false, reason: "no-session" };
  }

  const recent = await verifyRecentAuth(session.session.id);
  if (!recent.ok) {
    // A stale or missing recent-auth marker means the caller did not just
    // complete a fresh sign-in for this reactivation attempt. Refuse so
    // the UI can route the user back through the sign-in flow.
    return { ok: false, reason: "fresh-auth-required" };
  }

  try {
    await reactivateAccount({ userId: session.user.id });
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      return { ok: false, reason: "not-closed" };
    }
    if (error instanceof AccountNotReactivatableError) {
      if (error.reason === "window_expired") {
        return { ok: false, reason: "window-expired" };
      }
      return { ok: false, reason: "not-closed" };
    }
    log.error({ err: error, userId: session.user.id }, "account reactivation failed");
    throw error;
  }
}
