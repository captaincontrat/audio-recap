import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db/client";
import { user, type WorkspaceRole, workspace, workspaceMembership } from "@/lib/server/db/schema";
import { LastEligibleAdminError, PersonalWorkspaceViolationError, WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "./errors";
import { type AdminAccountRow, wouldViolateLastEligibleAdminInvariant } from "./invariants";

// Fetch every admin membership of a workspace alongside the minimal account
// state needed to decide eligibility. Kept local to this module because it
// is only needed to enforce the admin invariant — other callers use the
// simpler count path in `memberships.ts`.
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

// Refuse to modify or remove the last eligible active admin of an active
// team workspace. Personal workspaces are handled separately by
// `assertCanLeaveOrDeletePersonalWorkspace` — they never participate in
// the team admin invariant.
export async function assertCanModifyAdminMembership(args: {
  workspaceId: string;
  targetMembershipId: string;
  roleAfter?: WorkspaceRole;
  userExistsAfter?: boolean;
}): Promise<void> {
  const ws = await getDb().select().from(workspace).where(eq(workspace.id, args.workspaceId)).limit(1);
  const row = ws[0];
  if (!row) {
    throw new WorkspaceNotFoundError();
  }
  if (row.type === "personal") {
    return;
  }
  if (row.archivedAt) {
    return;
  }
  const admins = await loadAdminMemberships(args.workspaceId);
  if (
    wouldViolateLastEligibleAdminInvariant(admins, { membershipId: args.targetMembershipId, roleAfter: args.roleAfter, userExistsAfter: args.userExistsAfter })
  ) {
    throw new LastEligibleAdminError();
  }
}

// Refuse normal leave/delete actions on a personal workspace. `action` is
// accepted purely to improve the error surface — both leave and delete map
// to the same refusal today.
export async function assertCanLeaveOrDeletePersonalWorkspace(args: { workspaceId: string; userId: string; action: "leave" | "delete" }): Promise<void> {
  const ws = await getDb().select().from(workspace).where(eq(workspace.id, args.workspaceId)).limit(1);
  const row = ws[0];
  if (!row) {
    throw new WorkspaceNotFoundError();
  }
  if (row.type !== "personal") {
    return;
  }
  if (row.personalOwnerUserId !== args.userId) {
    throw new WorkspaceAccessDeniedError();
  }
  throw new PersonalWorkspaceViolationError(args.action === "leave" ? "You cannot leave your personal workspace" : "You cannot delete your personal workspace");
}
