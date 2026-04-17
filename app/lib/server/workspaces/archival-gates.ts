import { isWorkspaceActive, type WorkspaceArchivalTimestamps } from "./archival-state";
import { WorkspaceArchivedError } from "./errors";

// Gates every downstream capability can call to enforce the
// "archived workspaces become unavailable immediately" rule from the
// `workspace-archival-lifecycle` spec. Grouped as named functions so a
// call site communicates intent (e.g. `assertTranscriptLibraryAccessible`)
// while still funneling through one predicate and one error class.
//
// Callers pass the workspace timestamps (typically a `WorkspaceRow`) that
// the foundation resolver already loads. Everything here is pure so the
// rule can be exercised from unit tests without DB access.

type WorkspaceRowLike = WorkspaceArchivalTimestamps;

function assertActiveWorkspace(row: WorkspaceRowLike, message: string): void {
  if (!isWorkspaceActive(row)) {
    throw new WorkspaceArchivedError(message);
  }
}

// Gate the private transcript library and detail surfaces from
// `add-transcript-management`. Member-facing routes call this after
// resolving the workspace context from the URL slug.
export function assertTranscriptLibraryAccessible(row: WorkspaceRowLike): void {
  assertActiveWorkspace(row, "This workspace is archived and its transcripts are no longer accessible");
}

// Gate the authenticated transcript export surface from
// `add-client-side-transcript-export`. Runs after workspace + transcript
// resolution so the refusal is consistent with library access.
export function assertTranscriptExportAllowed(row: WorkspaceRowLike): void {
  assertActiveWorkspace(row, "This workspace is archived and transcript export is unavailable");
}

// Gate invitation acceptance from
// `add-workspace-membership-and-invitations`. The archival lifecycle
// promise is that archived workspaces refuse acceptance immediately
// without creating a membership, so callers pass the resolved workspace
// row to this helper before accepting.
export function assertInvitationAcceptanceAllowed(row: WorkspaceRowLike): void {
  assertActiveWorkspace(row, "This workspace is archived and invitations are no longer valid");
}

// Gate public share resolution from `add-public-transcript-sharing`.
// Used by the public-share route handler before looking up the target
// transcript. Combined with `isShareSuppressedByRestore` in
// `archival-state.ts`, it gives the public share capability its full
// archive/restore policy.
export function assertPublicShareResolvable(row: WorkspaceRowLike): void {
  assertActiveWorkspace(row, "This share link is unavailable because its workspace is archived");
}

// Gate transcript autosave attempts from `add-transcript-edit-sessions`.
// The archive transition additionally invokes the edit-session side
// effect so any active lock is released synchronously; this gate ensures
// any still-in-flight save request that arrives after archive is
// rejected rather than persisted.
export function assertAutosaveAllowed(row: WorkspaceRowLike): void {
  assertActiveWorkspace(row, "This workspace is archived and transcript autosaves are rejected");
}

// Convenience predicate for the edit-session entry flow. The spec
// explicitly refuses same-tab resume attempts after archive, so callers
// that want to branch on access (rather than throw) can use this.
// Returns `true` only for active workspaces.
export function canResumeEditSession(row: WorkspaceRowLike): boolean {
  return isWorkspaceActive(row);
}
