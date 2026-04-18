import "server-only";

import { and, eq, isNotNull, lte } from "drizzle-orm";
import { getDb } from "@/lib/server/db/client";
import { revokeSessionsForUser } from "@/lib/auth/accounts";
import { session as sessionTable, type UserRow, user, workspace, workspaceMembership } from "@/lib/server/db/schema";
import { wouldViolateLastEligibleAdminInvariant } from "@/lib/server/workspaces/invariants";
import { type AccountClosureEligibilityInputs, type AccountClosureEligibilityOutcome, evaluateAccountClosureEligibility } from "./closure-eligibility";
import { computeScheduledAccountDeleteAt, isPastReactivationWindow, isWithinReactivationWindow } from "./closure-state";
import { AccountClosureEligibilityError, AccountNotFoundError, AccountNotReactivatableError, AccountReactivationWindowActiveError } from "./errors";

// Server-only orchestration for the `account-closure-retention`
// transitions. The goal is to keep this file thin: pure rules live in
// `closure-state.ts` and `closure-eligibility.ts`, and this module
// composes them with DB writes and session revocation.
//
// Transitions:
//   1. `initiateAccountClosure` — evaluates eligibility (recent auth,
//      fresh 2FA when enabled, last-eligible-active-admin handoff), then
//      stamps `closedAt`/`scheduledDeleteAt`, revokes all sessions for
//      the account, and returns the retained-state row.
//   2. `reactivateAccount` — within the 30-day window, clears `closedAt`
//      /`scheduledDeleteAt` and returns the reactivated row. Callers
//      perform the fresh sign-in + fresh-2FA step-up themselves before
//      invoking this helper; previously revoked sessions stay revoked.
//   3. `permanentlyDeleteAccount` — removes the user row after the
//      reactivation window elapses. Cascading FK rules clean up
//      workspace membership, sessions, and credential accounts;
//      `transcript.createdByUserId` follows the `ON DELETE SET NULL`
//      contract so workspace-owned resources survive creator deletion.
//   4. `sweepExpiredClosedAccounts` — batch helper for the delayed
//      deletion job; finds every closed account whose window has elapsed
//      and permanently deletes it.

export type InitiateAccountClosureArgs = {
  userId: string;
  hasRecentAuth: boolean;
  freshSecondFactor: boolean;
  adminInvariantChecks: AccountClosureEligibilityInputs["adminInvariantChecks"];
  now?: Date;
};

export async function initiateAccountClosure(args: InitiateAccountClosureArgs): Promise<UserRow> {
  const db = getDb();
  const now = args.now ?? new Date();

  const existingRows = await db.select().from(user).where(eq(user.id, args.userId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new AccountNotFoundError();
  }

  const outcome: AccountClosureEligibilityOutcome = evaluateAccountClosureEligibility({
    alreadyClosed: existing.closedAt !== null,
    hasRecentAuth: args.hasRecentAuth,
    twoFactorEnabled: existing.twoFactorEnabled,
    freshSecondFactor: args.freshSecondFactor,
    adminInvariantChecks: args.adminInvariantChecks,
  });
  if (outcome.kind === "refused") {
    throw new AccountClosureEligibilityError(outcome.reason, { blockingWorkspaceIds: outcome.blockingWorkspaceIds });
  }

  const scheduledDeleteAt = computeScheduledAccountDeleteAt(now);
  const [updated] = await db.update(user).set({ closedAt: now, scheduledDeleteAt, updatedAt: now }).where(eq(user.id, args.userId)).returning();

  await revokeSessionsForUser({ userId: args.userId });

  return updated ?? existing;
}

export type ReactivateAccountArgs = {
  userId: string;
  now?: Date;
};

export async function reactivateAccount(args: ReactivateAccountArgs): Promise<UserRow> {
  const db = getDb();
  const now = args.now ?? new Date();

  const existingRows = await db.select().from(user).where(eq(user.id, args.userId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new AccountNotFoundError();
  }
  if (existing.closedAt === null) {
    throw new AccountNotReactivatableError("not_closed");
  }
  if (!isWithinReactivationWindow({ closedAt: existing.closedAt, scheduledDeleteAt: existing.scheduledDeleteAt }, now)) {
    throw new AccountNotReactivatableError("window_expired");
  }

  const [reactivated] = await db.update(user).set({ closedAt: null, scheduledDeleteAt: null, updatedAt: now }).where(eq(user.id, args.userId)).returning();

  return reactivated ?? existing;
}

export type PermanentlyDeleteAccountArgs = {
  userId: string;
  now?: Date;
};

// Permanently delete a closed account once its reactivation window has
// elapsed. The guard is required because the spec forbids permanent
// deletion before the 30-day window expires — the sweep job and any
// explicit operator-triggered deletion both route through this helper.
//
// The user row delete cascades to:
// - `session.user_id`          → session rows removed (ON DELETE CASCADE)
// - `account.user_id`          → credential/OAuth rows removed (ON DELETE CASCADE)
// - `passkey.user_id`          → enrolled passkeys removed (ON DELETE CASCADE)
// - `two_factor.user_id`       → 2FA enrollment removed (ON DELETE CASCADE)
// - `workspace_membership.user_id` → team memberships removed (ON DELETE CASCADE)
// - `workspace.personal_owner_user_id` → personal workspace deleted (ON DELETE CASCADE)
// - `email_verification_token.user_id` / `password_reset_token.user_id`
//                              → tokens removed (ON DELETE CASCADE)
// - `workspace_invitation.consumed_by_user_id` / `invited_by_user_id`
//                              → nullified (ON DELETE SET NULL) so invitation
//                                audit rows survive the deletion.
// - `transcript.created_by_user_id` → nullified (ON DELETE SET NULL) so
//                                workspace-owned resources in other workspaces
//                                survive the deletion and fall back to the
//                                generic `Former user (deleted)` attribution.
// - `processing_job.transcript_id` cascades follow the transcript, not the user.
export async function permanentlyDeleteAccount(args: PermanentlyDeleteAccountArgs): Promise<void> {
  const db = getDb();
  const now = args.now ?? new Date();
  const existingRows = await db.select().from(user).where(eq(user.id, args.userId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new AccountNotFoundError();
  }
  if (existing.closedAt === null) {
    throw new AccountNotReactivatableError("not_closed", "Cannot permanently delete an active account through the closure flow");
  }
  if (!isPastReactivationWindow({ closedAt: existing.closedAt, scheduledDeleteAt: existing.scheduledDeleteAt }, now)) {
    throw new AccountReactivationWindowActiveError();
  }

  // Remove any remaining team-workspace memberships and delete the
  // personal workspace explicitly before deleting the user row. The
  // foreign-key cascades below would handle both automatically, but
  // running them as separate statements keeps the deletion order
  // spec-aligned and logs each side effect for operators that review
  // permanent-deletion audit trails.
  await db.delete(workspaceMembership).where(eq(workspaceMembership.userId, args.userId));
  await db.delete(workspace).where(eq(workspace.personalOwnerUserId, args.userId));
  // Active sessions for a closed account should already have been revoked
  // during `initiateAccountClosure`, but the cascade below would tidy up
  // any row that lingered. Do it explicitly anyway so any downstream
  // token store (Better Auth, email verification) sees the deletion
  // propagate synchronously.
  await db.delete(sessionTable).where(eq(sessionTable.userId, args.userId));
  await db.delete(user).where(eq(user.id, args.userId));
}

// Sweep every closed account whose reactivation window has elapsed and
// permanently delete it. Intended to be called from a scheduled job.
// Returns the number of accounts deleted so the scheduler can log
// progress or emit metrics.
export async function sweepExpiredClosedAccounts(options: { now?: Date } = {}): Promise<{ deleted: number }> {
  const db = getDb();
  const now = options.now ?? new Date();

  const expired = await db
    .select({ id: user.id })
    .from(user)
    .where(and(isNotNull(user.closedAt), isNotNull(user.scheduledDeleteAt), lte(user.scheduledDeleteAt, now)));

  let deleted = 0;
  for (const row of expired) {
    await permanentlyDeleteAccount({ userId: row.id, now });
    deleted += 1;
  }
  return { deleted };
}

// Simulate the last-eligible-active-admin invariant against the caller's
// admin memberships, returning per-workspace results the closure
// eligibility evaluator consumes. Separate from `evaluateClosureEligibility`
// because it needs the DB; keeping it here lets the orchestration module
// own the one DB read path without re-implementing the invariant in the
// route handler.
export async function evaluateAdminHandoffForClosure(args: { userId: string }): Promise<AccountClosureEligibilityInputs["adminInvariantChecks"]> {
  const db = getDb();

  // Only non-personal workspaces enforce the last-eligible-active-admin
  // invariant; personal workspaces are handled by the dedicated personal
  // workspace rules. Fetch every admin membership the user holds in a
  // team workspace and simulate the closure outcome per workspace.
  const adminRows = await db
    .select({
      membershipId: workspaceMembership.id,
      workspaceId: workspaceMembership.workspaceId,
      workspaceType: workspace.type,
      workspaceArchivedAt: workspace.archivedAt,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(and(eq(workspaceMembership.userId, args.userId), eq(workspaceMembership.role, "admin")));

  const teamAdminRows = adminRows.filter((row) => row.workspaceType !== "personal" && row.workspaceArchivedAt === null);

  const results: Array<{ workspaceId: string; lastEligibleActiveAdmin: boolean }> = [];
  for (const row of teamAdminRows) {
    const admins = await db
      .select({
        membershipId: workspaceMembership.id,
        userId: workspaceMembership.userId,
        role: workspaceMembership.role,
        userRowId: user.id,
        userClosedAt: user.closedAt,
      })
      .from(workspaceMembership)
      .innerJoin(user, eq(user.id, workspaceMembership.userId))
      .where(and(eq(workspaceMembership.workspaceId, row.workspaceId), eq(workspaceMembership.role, "admin")));

    const wouldViolate = wouldViolateLastEligibleAdminInvariant(
      admins.map((a) => ({
        membershipId: a.membershipId,
        userId: a.userId,
        role: a.role,
        userExists: Boolean(a.userRowId),
        closedAt: a.userClosedAt,
      })),
      { membershipId: row.membershipId, closedAtAfter: new Date() },
    );
    results.push({ workspaceId: row.workspaceId, lastEligibleActiveAdmin: wouldViolate });
  }
  return results;
}
