// Client-safe predicate matching the server's submission gate.
// Keeping this aligned with `canRoleCreateTranscripts` and
// `isWorkspaceActive` on the server side means shell affordances grey
// themselves out for the same reasons the API would refuse the
// submission, so users never start a flow that the backend will
// immediately reject.

import type { WorkspaceRole } from "@/lib/server/db/schema";

import type { WorkspaceShellContextValue, WorkspaceShellWorkspace } from "../workspace-context";

// Roles permitted to start a new transcript. `read_only` is the only
// role that gets blocked at the shell level; mirroring the spec's
// `canRoleCreateTranscripts` keeps this in lockstep with the server.
const SUBMITTING_ROLES: ReadonlySet<WorkspaceRole> = new Set<WorkspaceRole>(["member", "admin"]);

export function canRoleSubmitTranscripts(role: WorkspaceRole): boolean {
  return SUBMITTING_ROLES.has(role);
}

export function canSubmitToWorkspace(workspace: WorkspaceShellWorkspace, role: WorkspaceRole): boolean {
  if (workspace.archivedAt !== null) return false;
  return canRoleSubmitTranscripts(role);
}

export function canSubmitToWorkspaceFromShellContext(context: WorkspaceShellContextValue): boolean {
  return canSubmitToWorkspace(context.workspace, context.currentRole);
}
