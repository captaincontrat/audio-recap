import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { RECENT_AUTH_MAX_AGE_SECONDS } from "@/lib/auth/two-factor-config";
import { getAuth } from "@/lib/auth/instance";
import { verifyRecentAuth } from "@/lib/auth/recent-auth";
import { getDb } from "@/lib/server/db/client";
import { session as sessionTable, twoFactor as twoFactorTable, user as userTable } from "@/lib/server/db/schema";
import { childLogger } from "@/lib/server/logger";
import type { AccountClosureRefusalReason } from "./closure-eligibility";
import { evaluateAdminHandoffForClosure, initiateAccountClosure } from "./closure";
import { AccountClosureEligibilityError, AccountNotFoundError } from "./errors";

export type CloseAccountActionResult =
  | { ok: true; scheduledDeleteAt: Date }
  | {
      ok: false;
      reason: "no-session" | "not-found" | AccountClosureRefusalReason;
      blockingWorkspaceIds?: ReadonlyArray<string>;
    };

// Server action behind the `/account/close` confirmation flow. Closure
// is one of the most destructive actions in the product, so this action
// re-checks every prerequisite server-side and refuses when any signal
// is missing or stale.
//
// Signals, all derived from server state (never trusted from the
// client):
//   - recent authentication: `session.lastAuthenticatedAt` within the
//     recent-auth window (see `verifyRecentAuth`). This is refreshed by
//     fresh sign-in, by the 2FA challenge that follows a fresh sign-in,
//     and by the dedicated `/account/recent-auth` password re-verify
//     prompt.
//   - fresh second-factor (only when the account has a verified 2FA
//     enrollment): `session.createdAt` within the recent-auth window.
//     Better Auth only creates a session row once the user has cleared
//     both primary and second-factor challenges; a fresh `createdAt`
//     therefore proves 2FA was exercised for *this* session. A
//     password-only re-verify refreshes `lastAuthenticatedAt` but does
//     not touch `createdAt`, so this check is what distinguishes a
//     full fresh sign-in from a password step-up.
//   - last-eligible-active-admin invariant: handled inside
//     `evaluateAdminHandoffForClosure`.
export async function closeCurrentAccount(): Promise<CloseAccountActionResult> {
  const log = childLogger({ component: "accounts.close" });
  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.session || !session.user) {
    return { ok: false, reason: "no-session" };
  }

  const recent = await verifyRecentAuth(session.session.id);
  const hasRecentAuth = recent.ok;

  const db = getDb();
  const userRows = await db.select().from(userTable).where(eq(userTable.id, session.user.id)).limit(1);
  const existing = userRows[0];
  if (!existing) {
    return { ok: false, reason: "not-found" };
  }

  // `twoFactorEnabled` on the user row reflects whether the Better Auth
  // `twoFactor` plugin considers the account enrolled. Cross-check the
  // `two_factor` row to confirm the enrollment is verified: an
  // in-progress enrollment should never force a fresh-2FA prompt on
  // closure because the user has not yet proven they possess the
  // authenticator.
  let twoFactorEnabled = existing.twoFactorEnabled;
  if (twoFactorEnabled) {
    const twoFactorRows = await db
      .select({ verified: twoFactorTable.verified })
      .from(twoFactorTable)
      .where(and(eq(twoFactorTable.userId, existing.id), eq(twoFactorTable.verified, true)))
      .limit(1);
    if (!twoFactorRows[0]) {
      twoFactorEnabled = false;
    }
  }

  let freshSecondFactor = true;
  if (twoFactorEnabled) {
    const sessionRows = await db.select({ createdAt: sessionTable.createdAt }).from(sessionTable).where(eq(sessionTable.id, session.session.id)).limit(1);
    const sessionCreatedAt = sessionRows[0]?.createdAt;
    if (!sessionCreatedAt) {
      freshSecondFactor = false;
    } else {
      const ageSeconds = (Date.now() - sessionCreatedAt.getTime()) / 1000;
      freshSecondFactor = ageSeconds <= RECENT_AUTH_MAX_AGE_SECONDS;
    }
  }

  const adminInvariantChecks = await evaluateAdminHandoffForClosure({ userId: existing.id });

  try {
    const updated = await initiateAccountClosure({
      userId: existing.id,
      hasRecentAuth,
      freshSecondFactor,
      adminInvariantChecks,
    });
    if (!updated.scheduledDeleteAt) {
      throw new Error("initiateAccountClosure returned a row without scheduledDeleteAt");
    }
    return { ok: true, scheduledDeleteAt: updated.scheduledDeleteAt };
  } catch (error) {
    if (error instanceof AccountClosureEligibilityError) {
      return {
        ok: false,
        reason: error.reason,
        blockingWorkspaceIds: error.blockingWorkspaceIds,
      };
    }
    if (error instanceof AccountNotFoundError) {
      return { ok: false, reason: "not-found" };
    }
    log.error({ err: error, userId: existing.id }, "account closure failed");
    throw error;
  }
}
