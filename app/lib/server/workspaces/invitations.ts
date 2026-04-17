import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { normalizeEmail } from "@/lib/auth/normalize";
import { createTokenMaterial, hashToken } from "@/lib/auth/token";
import { getDb } from "@/lib/server/db/client";
import { user, type WorkspaceInvitationRow, type WorkspaceRole, workspace, workspaceInvitation, workspaceMembership } from "@/lib/server/db/schema";
import {
  InvalidInvitationError,
  InvitationEmailMismatchError,
  InvitationTargetAlreadyMemberError,
  PersonalWorkspaceViolationError,
  WorkspaceAccessDeniedError,
  WorkspaceArchivedError,
  WorkspaceNotFoundError,
} from "./errors";
import {
  classifyInvitationValidity,
  computeInvitationExpiry,
  evaluateAcceptInvitation,
  evaluateInvitationAdminPreconditions,
  evaluateIssueInvitation,
  type GenericInvalidInvitationReason,
  type InvitationAcceptanceOutcome,
  type InvitationIssueRefusalReason,
  type InvitationMutationOutcome,
} from "./invitation-decisions";

// Server-only orchestration for the invitation lifecycle. Pure rules
// and the 7-day TTL live in `invitation-decisions.ts`; this module
// loads workspace/membership/invitation rows, composes the rules, and
// writes the mutations. Token material is issued through the shared
// `auth/token.ts` helpers so the hashing/rotation code path stays in
// one place.

export type IssueInvitationArgs = {
  workspaceId: string;
  callerUserId: string;
  email: string;
  role: WorkspaceRole;
  now?: Date;
};

export type IssueInvitationResult = {
  invitation: WorkspaceInvitationRow;
  /**
   * Cleartext invitation token. Only returned by issuance/resend so the
   * caller can embed it in the acceptance URL. Never stored again
   * after this call — the database only keeps the hashed form.
   */
  token: string;
};

// Issue a fresh invitation or refresh an existing pending one for the
// same `(workspaceId, normalizedEmail)` pair. Resend always rotates the
// token and refreshes the 7-day expiry, so the two flows share one
// implementation.
export async function issueWorkspaceInvitation(args: IssueInvitationArgs): Promise<IssueInvitationResult> {
  const db = getDb();
  const now = args.now ?? new Date();
  const normalizedEmail = normalizeEmail(args.email);
  const workspaceRow = await loadWorkspace(args.workspaceId);

  const callerRole = await getMembershipRoleRow({ workspaceId: args.workspaceId, userId: args.callerUserId });

  // Is there already a matching member for this email? If so, the
  // admin should change their role instead of inviting them. The
  // decision module surfaces a dedicated refusal code so UI copy can
  // route the admin to the role-change affordance.
  const targetAlreadyMember = await isEmailAlreadyAMember({ workspaceId: args.workspaceId, email: normalizedEmail });

  const outcome = evaluateIssueInvitation({
    workspace: { type: workspaceRow.type, archivedAt: workspaceRow.archivedAt },
    caller: { role: callerRole },
    targetAlreadyMember,
  });
  ensureIssueAllowed(outcome);

  const existing = await db
    .select()
    .from(workspaceInvitation)
    .where(
      and(eq(workspaceInvitation.workspaceId, args.workspaceId), eq(workspaceInvitation.email, normalizedEmail), eq(workspaceInvitation.status, "pending")),
    )
    .limit(1);
  const previous = existing[0];

  const material = createTokenMaterial();
  const expiresAt = computeInvitationExpiry(now);

  if (previous) {
    // Resend/refresh: rotate the hash, refresh the expiry window,
    // keep the row id and audit trail intact. The partial-unique
    // index on `(workspaceId, email) WHERE status = 'pending'` allows
    // in-place updates.
    const [updated] = await db
      .update(workspaceInvitation)
      .set({
        tokenHash: material.hash,
        expiresAt,
        role: args.role,
        invitedByUserId: args.callerUserId,
        updatedAt: now,
      })
      .where(eq(workspaceInvitation.id, previous.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to refresh invitation");
    }
    return { invitation: updated, token: material.token };
  }

  const [inserted] = await db
    .insert(workspaceInvitation)
    .values({
      id: randomUUID(),
      workspaceId: args.workspaceId,
      email: normalizedEmail,
      role: args.role,
      status: "pending",
      tokenHash: material.hash,
      expiresAt,
      invitedByUserId: args.callerUserId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!inserted) {
    throw new Error("Failed to create invitation");
  }
  return { invitation: inserted, token: material.token };
}

export type RevokeInvitationArgs = {
  workspaceId: string;
  callerUserId: string;
  invitationId: string;
  now?: Date;
};

// Admin revokes a pending invitation. Terminal rows (accepted, already
// revoked/expired/superseded) are treated as a no-op; the spec says
// every invalid link collapses to the same generic behavior so there's
// nothing extra to tell an admin who double-clicks revoke.
export async function revokeWorkspaceInvitation(args: RevokeInvitationArgs): Promise<WorkspaceInvitationRow> {
  const db = getDb();
  const now = args.now ?? new Date();
  const workspaceRow = await loadWorkspace(args.workspaceId);

  const callerRole = await getMembershipRoleRow({ workspaceId: args.workspaceId, userId: args.callerUserId });
  ensureIssueAllowed(
    evaluateInvitationAdminPreconditions({
      workspace: { type: workspaceRow.type, archivedAt: workspaceRow.archivedAt },
      caller: { role: callerRole },
    }),
  );

  const rows = await db.select().from(workspaceInvitation).where(eq(workspaceInvitation.id, args.invitationId)).limit(1);
  const row = rows[0];
  if (!row || row.workspaceId !== args.workspaceId) {
    throw new WorkspaceNotFoundError("Invitation does not exist");
  }
  if (row.status !== "pending") {
    return row;
  }

  const [updated] = await db
    .update(workspaceInvitation)
    .set({
      status: "revoked",
      tokenHash: null,
      updatedAt: now,
    })
    .where(eq(workspaceInvitation.id, row.id))
    .returning();
  if (!updated) {
    throw new Error("Failed to revoke invitation");
  }
  return updated;
}

export type ResendInvitationArgs = {
  workspaceId: string;
  callerUserId: string;
  invitationId: string;
  now?: Date;
};

// Admin resends a pending invitation: rotate the token, refresh the
// 7-day window, keep the row id. Delegates to `issueWorkspaceInvitation`
// after looking up the invitation's email + role so the two flows can't
// drift.
export async function resendWorkspaceInvitation(args: ResendInvitationArgs): Promise<IssueInvitationResult> {
  const rows = await getDb().select().from(workspaceInvitation).where(eq(workspaceInvitation.id, args.invitationId)).limit(1);
  const row = rows[0];
  if (!row || row.workspaceId !== args.workspaceId) {
    throw new WorkspaceNotFoundError("Invitation does not exist");
  }
  if (row.status !== "pending") {
    // Resending a terminal invitation shouldn't silently produce a new
    // link — the admin should use "invite again" instead, which goes
    // through `issueWorkspaceInvitation` with a fresh email/role.
    throw new InvalidInvitationError("Only pending invitations can be resent");
  }
  return issueWorkspaceInvitation({
    workspaceId: args.workspaceId,
    callerUserId: args.callerUserId,
    email: row.email,
    role: row.role,
    now: args.now,
  });
}

// Look up an invitation by its cleartext token. Returns the row when
// the lookup succeeds; throws `InvalidInvitationError` for every
// "link no longer usable" case so public acceptance surfaces can fail
// uniformly without leaking internal state.
export async function findPendingInvitationByToken(args: { token: string; now?: Date }): Promise<WorkspaceInvitationRow> {
  const now = args.now ?? new Date();
  const tokenHash = hashToken(args.token);
  const rows = await getDb().select().from(workspaceInvitation).where(eq(workspaceInvitation.tokenHash, tokenHash)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new InvalidInvitationError();
  }
  const classification = classifyInvitationValidity(row, now);
  if (classification.kind === "invalid") {
    throw new InvalidInvitationError();
  }
  return row;
}

export type AcceptInvitationArgs = {
  token: string;
  acceptingUserId: string;
  now?: Date;
};

export type AcceptInvitationResult = {
  membershipId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

// Accept an invitation on behalf of the currently-authenticated user.
// Refuses (with `InvitationEmailMismatchError`) when the accepting
// account's email differs from the invited email. Refuses (with
// `InvalidInvitationError`) for every lifecycle-invalid state.
//
// On success: creates the workspace membership, stamps `consumed_at`
// and `consumed_by_user_id`, clears `tokenHash`, and flips the row to
// `accepted` — so the same token can never create a second membership.
export async function acceptWorkspaceInvitation(args: AcceptInvitationArgs): Promise<AcceptInvitationResult> {
  const db = getDb();
  const now = args.now ?? new Date();
  const tokenHash = hashToken(args.token);

  const rows = await db.select().from(workspaceInvitation).where(eq(workspaceInvitation.tokenHash, tokenHash)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new InvalidInvitationError();
  }
  const workspaceRow = (await db.select().from(workspace).where(eq(workspace.id, row.workspaceId)).limit(1))[0];
  const acceptingUser = (await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, args.acceptingUserId)).limit(1))[0];
  if (!acceptingUser) {
    throw new WorkspaceAccessDeniedError("Acceptance requires a signed-in account");
  }
  const alreadyMember = Boolean(
    (
      await db
        .select({ id: workspaceMembership.id })
        .from(workspaceMembership)
        .where(and(eq(workspaceMembership.workspaceId, row.workspaceId), eq(workspaceMembership.userId, args.acceptingUserId)))
        .limit(1)
    )[0],
  );

  const outcome = evaluateAcceptInvitation({
    invitation: { status: row.status, expiresAt: row.expiresAt, email: row.email },
    workspace: workspaceRow ? { type: workspaceRow.type, archivedAt: workspaceRow.archivedAt } : null,
    acceptingUserEmail: acceptingUser.email,
    alreadyMember,
    now,
  });
  throwAcceptanceRefusal(outcome);

  const membershipId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(workspaceMembership).values({
      id: membershipId,
      workspaceId: row.workspaceId,
      userId: args.acceptingUserId,
      role: row.role,
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .update(workspaceInvitation)
      .set({
        status: "accepted",
        tokenHash: null,
        consumedAt: now,
        consumedByUserId: args.acceptingUserId,
        updatedAt: now,
      })
      .where(eq(workspaceInvitation.id, row.id));
  });

  return { membershipId, workspaceId: row.workspaceId, role: row.role };
}

// Admin-facing listing of a workspace's invitations. Returns all
// statuses so the UI can show "pending", "accepted", and "revoked"
// groupings in one go; the caller is responsible for hiding terminal
// invitations it doesn't want to display.
export async function listWorkspaceInvitations(args: { workspaceId: string; callerUserId: string }): Promise<WorkspaceInvitationRow[]> {
  const workspaceRow = await loadWorkspace(args.workspaceId);
  const callerRole = await getMembershipRoleRow({ workspaceId: args.workspaceId, userId: args.callerUserId });
  ensureIssueAllowed(
    evaluateInvitationAdminPreconditions({
      workspace: { type: workspaceRow.type, archivedAt: workspaceRow.archivedAt },
      caller: { role: callerRole },
    }),
  );
  return getDb().select().from(workspaceInvitation).where(eq(workspaceInvitation.workspaceId, args.workspaceId));
}

// Mark pending invitations that have passed their expiry as
// `expired`. Intended for a scheduled sweep; callers don't need it
// during live acceptance because `classifyInvitationValidity`
// already treats an overdue pending row as invalid.
export async function expirePendingInvitations(options: { now?: Date } = {}): Promise<{ expired: number }> {
  const db = getDb();
  const now = options.now ?? new Date();
  const result = await db
    .update(workspaceInvitation)
    .set({ status: "expired", tokenHash: null, updatedAt: now })
    .where(and(eq(workspaceInvitation.status, "pending"), isNotNull(workspaceInvitation.expiresAt), lte(workspaceInvitation.expiresAt, now)))
    .returning({ id: workspaceInvitation.id });
  return { expired: result.length };
}

// Mark every pending invitation for a workspace as `superseded` and
// drop its token hash. Invoked from the archive side effect so that
// archived workspaces refuse acceptance immediately, per the
// `workspace-archival-lifecycle` spec which keeps that behavior
// centralized.
export async function invalidateWorkspaceInvitationsOnArchive(args: { workspaceId: string; now: Date }): Promise<{ invalidated: number }> {
  const db = getDb();
  const result = await db
    .update(workspaceInvitation)
    .set({ status: "superseded", tokenHash: null, updatedAt: args.now })
    .where(and(eq(workspaceInvitation.workspaceId, args.workspaceId), eq(workspaceInvitation.status, "pending")))
    .returning({ id: workspaceInvitation.id });
  return { invalidated: result.length };
}

// Shared helpers -----------------------------------------------------

async function loadWorkspace(workspaceId: string) {
  const rows = await getDb().select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new WorkspaceNotFoundError();
  }
  return row;
}

async function getMembershipRoleRow(args: { workspaceId: string; userId: string }): Promise<WorkspaceRole | null> {
  const rows = await getDb()
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(and(eq(workspaceMembership.workspaceId, args.workspaceId), eq(workspaceMembership.userId, args.userId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

async function isEmailAlreadyAMember(args: { workspaceId: string; email: string }): Promise<boolean> {
  const rows = await getDb()
    .select({ id: workspaceMembership.id })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(and(eq(workspaceMembership.workspaceId, args.workspaceId), eq(user.email, args.email)))
    .limit(1);
  return rows.length > 0;
}

function ensureIssueAllowed(outcome: InvitationMutationOutcome): void {
  if (outcome.kind === "refused") {
    throwIssueRefusal(outcome.reason);
  }
}

function throwIssueRefusal(reason: InvitationIssueRefusalReason): never {
  switch (reason) {
    case "personal_workspace":
      throw new PersonalWorkspaceViolationError("Personal workspaces cannot be invited into");
    case "workspace_archived":
      throw new WorkspaceArchivedError();
    case "not_admin_caller":
      throw new WorkspaceAccessDeniedError("Only workspace admins can manage invitations");
    case "target_already_member":
      throw new InvitationTargetAlreadyMemberError();
  }
}

// Raised when acceptance finds the signed-in user already has a
// membership on the target workspace. Surfaced as a distinct code so
// UI code can route the user to the workspace landing instead of
// showing an error.
export class MembershipAlreadyExistsError extends Error {
  readonly code = "invitation_already_member" as const;
  constructor(message = "You are already a member of this workspace") {
    super(message);
    this.name = "MembershipAlreadyExistsError";
  }
}

function throwAcceptanceRefusal(outcome: InvitationAcceptanceOutcome): void {
  if (outcome.kind === "allowed") return;
  switch (outcome.reason) {
    case "invalid_link":
      throw new InvalidInvitationError();
    case "workspace_archived":
      throw new WorkspaceArchivedError();
    case "email_mismatch":
      throw new InvitationEmailMismatchError();
    case "already_a_member":
      // The acceptance handler surfaces this distinct code so the UI
      // can route the user to the workspace landing instead of
      // showing an error banner.
      throw new MembershipAlreadyExistsError();
  }
}

export type { GenericInvalidInvitationReason };
