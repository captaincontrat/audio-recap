import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/server/db/client";
import { user, type WorkspaceMembershipRow, type WorkspaceRole, type WorkspaceRow, workspace, workspaceMembership } from "@/lib/server/db/schema";
import { countEligibleActiveAdmins as countFromInputs, isEligibleActiveAdmin } from "./eligibility";

export type MembershipContext = {
  workspace: WorkspaceRow;
  membership: WorkspaceMembershipRow;
  role: WorkspaceRole;
};

// Resolve the membership role for a `(workspaceId, userId)` pair. Returns
// `null` when the user has no membership, so route guards can distinguish
// "no access" from a specific role-based decision.
export async function getMembershipRole(args: { workspaceId: string; userId: string }): Promise<WorkspaceRole | null> {
  const rows = await getDb()
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(and(eq(workspaceMembership.workspaceId, args.workspaceId), eq(workspaceMembership.userId, args.userId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

// Count eligible active admins for a workspace by joining memberships with
// the user table and applying the shared `eligibility` predicate. The DB
// join is the single place where additional account-access columns (future
// `closed_at`, `suspended_at`) need to flow in when later capabilities
// extend account state.
export async function countEligibleActiveAdmins(workspaceId: string): Promise<number> {
  const rows = await getDb()
    .select({
      role: workspaceMembership.role,
      userId: user.id,
    })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(and(eq(workspaceMembership.workspaceId, workspaceId), eq(workspaceMembership.role, "admin")));
  return countFromInputs(
    rows.map((row) => ({
      role: row.role,
      account: { userExists: row.userId !== null && row.userId !== undefined },
    })),
  );
}

// Fetch the memberships+workspaces a user belongs to, ordered by
// `last_accessed_at` descending. Used by the default-landing resolver to
// pick the most recently used accessible workspace.
export async function listAccessibleWorkspacesForUser(userId: string): Promise<
  Array<{
    membership: WorkspaceMembershipRow;
    workspace: WorkspaceRow;
  }>
> {
  const rows = await getDb()
    .select({
      membership: workspaceMembership,
      workspace,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, userId))
    .orderBy(desc(workspaceMembership.lastAccessedAt));
  return rows;
}

// Touch `last_accessed_at` after a successful workspace-scoped access.
// Routes call this so the default-landing fallback (rule 2) has up-to-date
// data to choose from.
export async function touchMembershipAccess(args: { workspaceId: string; userId: string; now?: Date }): Promise<void> {
  const now = args.now ?? new Date();
  await getDb()
    .update(workspaceMembership)
    .set({ lastAccessedAt: now, updatedAt: now })
    .where(and(eq(workspaceMembership.workspaceId, args.workspaceId), eq(workspaceMembership.userId, args.userId)));
}

// Helper consumed by invariant checks that need to reason about *all* admins
// of a workspace (including ineligible ones), for example to report how
// many admin slots the workspace has left before the guard fires.
export async function describeAdminMemberships(workspaceId: string): Promise<
  Array<{
    membership: WorkspaceMembershipRow;
    isEligible: boolean;
  }>
> {
  const rows = await getDb()
    .select({
      membership: workspaceMembership,
      userId: user.id,
    })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(and(eq(workspaceMembership.workspaceId, workspaceId), eq(workspaceMembership.role, "admin")));
  return rows.map((row) => ({
    membership: row.membership,
    isEligible: isEligibleActiveAdmin({ role: row.membership.role, account: { userExists: Boolean(row.userId) } }),
  }));
}

// Utility for bulk fetches; exported to keep the resolver module thin.
export async function findWorkspacesByIds(ids: readonly string[]): Promise<WorkspaceRow[]> {
  if (ids.length === 0) return [];
  return getDb().select().from(workspace).where(inArray(workspace.id, ids));
}
