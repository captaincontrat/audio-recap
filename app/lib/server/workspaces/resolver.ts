import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db/client";
import { type WorkspaceMembershipRow, type WorkspaceRole, type WorkspaceRow, workspace, workspaceMembership } from "@/lib/server/db/schema";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "./errors";
import { type ExplicitDestination, type LandingDecision, type PersonalWorkspaceRef, type RememberedWorkspace, resolveDefaultLanding } from "./landing";
import { listAccessibleWorkspacesForUser } from "./memberships";
import { ensurePersonalWorkspace } from "./personal";

export type ResolvedWorkspaceContext = {
  workspace: WorkspaceRow;
  membership: WorkspaceMembershipRow;
  role: WorkspaceRole;
};

// Resolve the current workspace for a workspace-scoped private route. The
// URL segment (`slug`) is authoritative; session state and remembered
// workspace preference MUST NOT override it (see spec,
// "Workspace-scoped private routes use explicit workspace context").
//
// Callers that also need to gate against archived workspaces should branch
// on `result.workspace.archivedAt` themselves.
export async function resolveWorkspaceContextFromSlug(args: { slug: string; userId: string }): Promise<ResolvedWorkspaceContext> {
  const db = getDb();
  const workspaceRows = await db.select().from(workspace).where(eq(workspace.slug, args.slug)).limit(1);
  const workspaceRow = workspaceRows[0];
  if (!workspaceRow) {
    throw new WorkspaceNotFoundError();
  }

  const membershipRows = await db
    .select()
    .from(workspaceMembership)
    .where(and(eq(workspaceMembership.workspaceId, workspaceRow.id), eq(workspaceMembership.userId, args.userId)))
    .limit(1);
  const membership = membershipRows[0];
  if (!membership) {
    throw new WorkspaceAccessDeniedError();
  }

  return {
    workspace: workspaceRow,
    membership,
    role: membership.role,
  };
}

// Pick the workspace an authenticated user should land on when entering an
// authenticated surface without an explicit workspace-scoped destination.
//
// Caller provides:
// - `explicitDestination`: optional `returnTo`-style intent already
//   validated as an authorized destination.
// - `userId`: the signed-in account.
//
// This function never overrides an explicit destination; if one is present
// and authorized, it returns a `{ kind: "explicit", path }` decision
// without touching the database.
export async function resolveDefaultLandingForUser(args: {
  userId: string;
  explicitDestination?: ExplicitDestination | null;
  now?: Date;
}): Promise<LandingDecision> {
  if (args.explicitDestination && args.explicitDestination.isAuthorized) {
    return {
      kind: "explicit",
      path: args.explicitDestination.path,
    };
  }

  const memberships = await listAccessibleWorkspacesForUser(args.userId);
  const lastValidWorkspace: RememberedWorkspace | null = findLastValidWorkspace(memberships);
  const personal = ensurePersonalRefFrom(memberships) ?? (await provisionPersonalRef(args.userId, args.now));

  return resolveDefaultLanding({
    explicitDestination: args.explicitDestination ?? null,
    lastValidWorkspace,
    personalWorkspace: personal,
  });
}

// Resolve a current workspace context for non-workspace shell routes
// (account-scoped pages hosted inside the shared shell). Reuses the
// same default-workspace selection as `/dashboard` — last successfully
// used accessible active workspace, otherwise the user's personal
// workspace — and then loads the full `ResolvedWorkspaceContext` for
// that workspace so the shared shell can populate its providers exactly
// as it does on workspace-scoped routes.
//
// This helper deliberately does NOT accept an explicit destination:
// account routes have their own URL contract and are not deep-link
// destinations the resolver needs to respect.
export async function resolveDefaultWorkspaceContextForUser(args: { userId: string; now?: Date }): Promise<ResolvedWorkspaceContext> {
  const decision = await resolveDefaultLandingForUser({ userId: args.userId, now: args.now });
  if (decision.kind === "explicit") {
    throw new Error("Default workspace context resolver must not produce an explicit destination");
  }
  return resolveWorkspaceContextFromSlug({ slug: decision.slug, userId: args.userId });
}

function findLastValidWorkspace(memberships: Array<{ membership: WorkspaceMembershipRow; workspace: WorkspaceRow }>): RememberedWorkspace | null {
  for (const entry of memberships) {
    if (entry.membership.lastAccessedAt === null) {
      continue;
    }
    if (entry.workspace.archivedAt !== null) {
      continue;
    }
    return {
      workspaceId: entry.workspace.id,
      slug: entry.workspace.slug,
      accessible: true,
      active: true,
    };
  }
  return null;
}

function ensurePersonalRefFrom(memberships: Array<{ membership: WorkspaceMembershipRow; workspace: WorkspaceRow }>): PersonalWorkspaceRef | null {
  for (const entry of memberships) {
    if (entry.workspace.type === "personal") {
      return {
        workspaceId: entry.workspace.id,
        slug: entry.workspace.slug,
      };
    }
  }
  return null;
}

async function provisionPersonalRef(userId: string, now: Date | undefined): Promise<PersonalWorkspaceRef> {
  // Safety net: if a pre-workspace account slipped through the sign-up
  // bootstrap, the resolver lazily provisions the personal workspace before
  // landing the user. This complements the backfill path documented in
  // the personal module.
  const created = await ensurePersonalWorkspace({ userId, now });
  return { workspaceId: created.id, slug: created.slug };
}
