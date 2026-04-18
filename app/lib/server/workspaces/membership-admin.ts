import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db/client";
import { user, type WorkspaceMembershipRow, type WorkspaceRole, workspace, workspaceMembership } from "@/lib/server/db/schema";
import { LastEligibleAdminError, PersonalWorkspaceViolationError, WorkspaceAccessDeniedError, WorkspaceArchivedError, WorkspaceNotFoundError } from "./errors";
import type { AdminAccountRow } from "./invariants";
import {
  evaluateAddMembership,
  evaluateChangeRole,
  evaluateRemoveMembership,
  type MembershipMutationOutcome,
  type MembershipMutationRefusalReason,
} from "./membership-decisions";

// Server-only orchestration for the admin-managed membership flows.
// Keeps the `workspaceId → workspace row`, `userId → membership`, and
// `admin memberships` lookups here so the pure-decision module in
// `membership-decisions.ts` stays trivially unit-testable without a
// database.

// Fetch every admin membership of a workspace with the minimal account
// state needed for the "eligible active admin" predicate. Mirrors the
// helper in `invariant-guards.ts`; kept local so the admin service can
// load it once and reuse it across pre-checks and invariant simulation.
async function loadAdminMemberships(workspaceId: string): Promise<AdminAccountRow[]> {
  const rows = await getDb()
    .select({
      membershipId: workspaceMembership.id,
      userId: workspaceMembership.userId,
      role: workspaceMembership.role,
      userRowId: user.id,
      userClosedAt: user.closedAt,
    })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(and(eq(workspaceMembership.workspaceId, workspaceId), eq(workspaceMembership.role, "admin")));
  return rows.map((row) => ({
    membershipId: row.membershipId,
    userId: row.userId,
    role: row.role,
    userExists: Boolean(row.userRowId),
    closedAt: row.userClosedAt,
  }));
}

// Raise the error class that matches a refusal reason. Keeps a single
// mapping between the pure decision module and the error classes that
// API handlers match on. An exhaustive switch guarantees new reasons
// fail the type-check instead of silently falling through to a generic
// 500.
function throwRefusal(reason: MembershipMutationRefusalReason): never {
  switch (reason) {
    case "personal_workspace":
      throw new PersonalWorkspaceViolationError("Personal workspaces do not support additional memberships");
    case "workspace_archived":
      throw new WorkspaceArchivedError();
    case "not_admin_caller":
      throw new WorkspaceAccessDeniedError("Only workspace admins can manage memberships");
    case "last_eligible_admin":
      throw new LastEligibleAdminError();
    case "target_not_a_member":
      throw new WorkspaceNotFoundError("Target membership does not exist");
    case "role_unchanged":
      throw new MembershipRoleUnchangedError();
  }
}

function ensureAllowed(outcome: MembershipMutationOutcome): void {
  if (outcome.kind === "refused") {
    throwRefusal(outcome.reason);
  }
}

// Dedicated error for a no-op role change. Kept here (rather than in
// `errors.ts`) because it is internal to the admin membership flow and
// is not shared with other capabilities.
export class MembershipRoleUnchangedError extends Error {
  readonly code = "membership_role_unchanged" as const;
  constructor(message = "Membership already has the requested role") {
    super(message);
    this.name = "MembershipRoleUnchangedError";
  }
}

export type AddMembershipArgs = {
  workspaceId: string;
  callerUserId: string;
  targetUserId: string;
  role: WorkspaceRole;
  now?: Date;
};

// Admin adds an existing user account to a team workspace with a chosen
// role. Refuses on personal workspaces, archived workspaces, non-admin
// callers, and when the target already has a membership (the mutation is
// not idempotent; the admin should use role-change instead).
export async function addWorkspaceMembership(args: AddMembershipArgs): Promise<WorkspaceMembershipRow> {
  const db = getDb();
  const now = args.now ?? new Date();
  const workspaceRow = await loadWorkspace(args.workspaceId);

  const callerRole = await getMembershipRoleRow({ workspaceId: args.workspaceId, userId: args.callerUserId });
  const outcome = evaluateAddMembership({
    workspace: { type: workspaceRow.type, archivedAt: workspaceRow.archivedAt },
    caller: { role: callerRole },
  });
  ensureAllowed(outcome);

  const existingTarget = await db
    .select()
    .from(workspaceMembership)
    .where(and(eq(workspaceMembership.workspaceId, args.workspaceId), eq(workspaceMembership.userId, args.targetUserId)))
    .limit(1);
  if (existingTarget[0]) {
    return existingTarget[0];
  }

  const targetAccount = await db.select({ id: user.id }).from(user).where(eq(user.id, args.targetUserId)).limit(1);
  if (!targetAccount[0]) {
    throw new WorkspaceNotFoundError("Target account does not exist");
  }

  const [inserted] = await db
    .insert(workspaceMembership)
    .values({
      id: randomUUID(),
      workspaceId: args.workspaceId,
      userId: args.targetUserId,
      role: args.role,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!inserted) {
    throw new Error("Failed to create workspace membership");
  }
  return inserted;
}

export type RemoveMembershipArgs = {
  workspaceId: string;
  callerUserId: string;
  targetMembershipId: string;
  now?: Date;
};

// Admin removes a membership. Refuses when removal would leave the
// workspace with no eligible active admin. The DB-level membership row
// is deleted; downstream creator-attribution columns are unaffected.
export async function removeWorkspaceMembership(args: RemoveMembershipArgs): Promise<void> {
  const db = getDb();
  const workspaceRow = await loadWorkspace(args.workspaceId);

  const callerRole = await getMembershipRoleRow({ workspaceId: args.workspaceId, userId: args.callerUserId });
  const targetRows = await db
    .select({ id: workspaceMembership.id, workspaceId: workspaceMembership.workspaceId, userId: workspaceMembership.userId })
    .from(workspaceMembership)
    .where(eq(workspaceMembership.id, args.targetMembershipId))
    .limit(1);
  const target = targetRows[0];

  const targetMembership = target && target.workspaceId === args.workspaceId ? { id: target.id, userExists: true } : null;

  const admins = await loadAdminMemberships(args.workspaceId);
  const outcome = evaluateRemoveMembership({
    workspace: { type: workspaceRow.type, archivedAt: workspaceRow.archivedAt },
    caller: { role: callerRole },
    targetMembership,
    adminMemberships: admins,
  });
  ensureAllowed(outcome);

  await db.delete(workspaceMembership).where(eq(workspaceMembership.id, args.targetMembershipId));
}

export type ChangeMembershipRoleArgs = {
  workspaceId: string;
  callerUserId: string;
  targetMembershipId: string;
  nextRole: WorkspaceRole;
  now?: Date;
};

// Admin changes the role on an existing membership. Refuses when the
// change would leave the workspace with no eligible active admin
// (downgrading the last admin) and when the role is already the target
// role (so the UI can distinguish "no change" from a successful write).
export async function changeWorkspaceMembershipRole(args: ChangeMembershipRoleArgs): Promise<WorkspaceMembershipRow> {
  const db = getDb();
  const now = args.now ?? new Date();
  const workspaceRow = await loadWorkspace(args.workspaceId);

  const callerRole = await getMembershipRoleRow({ workspaceId: args.workspaceId, userId: args.callerUserId });
  const targetRows = await db
    .select({ id: workspaceMembership.id, workspaceId: workspaceMembership.workspaceId, role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(eq(workspaceMembership.id, args.targetMembershipId))
    .limit(1);
  const target = targetRows[0];
  const targetMembership = target && target.workspaceId === args.workspaceId ? { id: target.id, currentRole: target.role } : null;

  const admins = await loadAdminMemberships(args.workspaceId);
  const outcome = evaluateChangeRole({
    workspace: { type: workspaceRow.type, archivedAt: workspaceRow.archivedAt },
    caller: { role: callerRole },
    targetMembership,
    nextRole: args.nextRole,
    adminMemberships: admins,
  });
  ensureAllowed(outcome);

  const [updated] = await db
    .update(workspaceMembership)
    .set({ role: args.nextRole, updatedAt: now })
    .where(eq(workspaceMembership.id, args.targetMembershipId))
    .returning();
  if (!updated) {
    throw new Error("Failed to update workspace membership");
  }
  return updated;
}

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
