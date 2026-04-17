// Pure helpers for reasoning about workspace archival state. The DB row
// exposes three durable timestamps owned by the archival lifecycle
// (`archivedAt`, `scheduledDeleteAt`, `restoredAt`). Every downstream
// capability that gates behavior on whether a workspace is "active" or
// "archived" should derive its decision from these predicates instead of
// re-implementing the rules.
//
// The helpers are intentionally shape-only — they accept the three fields
// directly so the same logic works for full workspace rows, API
// projections, and in-memory simulations in tests.

// The restoration window is fixed at 60 days by the
// `workspace-archival-lifecycle` spec. Helpers that need to compute the
// scheduled-delete moment from an archive moment go through
// `computeScheduledDeleteAt` so the constant has a single source of truth.
export const RESTORATION_WINDOW_DAYS = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

// Timestamp surface consumed by every predicate in this module. Callers
// typically pass the relevant subset of a `WorkspaceRow`, but the shape
// stays independent of Drizzle so tests and non-DB callers can construct
// it directly.
export type WorkspaceArchivalTimestamps = {
  archivedAt: Date | null;
  scheduledDeleteAt: Date | null;
  restoredAt: Date | null;
};

// Derived lifecycle state. "active" is the default; "archived_restorable"
// and "archived_past_restoration_window" split the archived state so
// callers that want to distinguish "can still restore" from "eligible for
// permanent deletion" can branch without recomputing the window math.
export type WorkspaceArchivalState = "active" | "archived_restorable" | "archived_past_restoration_window";

// Compute the exact moment when an archive will exit its restoration
// window. Keeping the computation here means callers never open-code the
// 60-day arithmetic.
export function computeScheduledDeleteAt(archivedAt: Date): Date {
  return new Date(archivedAt.getTime() + RESTORATION_WINDOW_DAYS * MS_PER_DAY);
}

// Is the workspace currently active? Active means `archivedAt` is null;
// `restoredAt` can be set without the workspace being archived (it simply
// remembers the last restore). Downstream gate helpers read this to
// refuse private transcript surfaces, authenticated export, invitation
// acceptance, public share resolution, and autosaves on an archived
// workspace.
export function isWorkspaceActive(row: WorkspaceArchivalTimestamps): boolean {
  return row.archivedAt === null;
}

export function isWorkspaceArchived(row: WorkspaceArchivalTimestamps): boolean {
  return row.archivedAt !== null;
}

// Has an archived workspace outlived its restoration window? Returns
// false for active workspaces so the deletion sweep never mistakes an
// active workspace for a permanent-delete candidate.
export function isPastRestorationWindow(row: WorkspaceArchivalTimestamps, now: Date): boolean {
  if (row.archivedAt === null) return false;
  if (row.scheduledDeleteAt === null) return false;
  return now.getTime() >= row.scheduledDeleteAt.getTime();
}

// Derive the tri-state lifecycle label. Centralizing this keeps the
// state machine pinned to the three timestamps: anything that reasons
// about "where is this workspace in the archive lifecycle" should go
// through `deriveArchivalState`.
export function deriveArchivalState(row: WorkspaceArchivalTimestamps, now: Date): WorkspaceArchivalState {
  if (row.archivedAt === null) return "active";
  if (isPastRestorationWindow(row, now)) return "archived_past_restoration_window";
  return "archived_restorable";
}

// Was a share configured (e.g. a public transcript share) before the
// workspace was last restored? The `workspace-archival-lifecycle` spec
// requires previously enabled public share links to stay inactive after
// restore until a `member` or `admin` performs a fresh share-management
// action. Downstream share resolution passes the share's own
// `updatedAt` alongside the workspace row so this helper returns `true`
// when the share has not been touched since the restore — i.e. the
// post-restore suppression still applies.
//
// Returns `false` for workspaces that have never been restored (a
// never-archived workspace has `restoredAt === null`) so pre-lifecycle
// shares remain available to the resolution caller.
export function isShareSuppressedByRestore(args: { workspace: WorkspaceArchivalTimestamps; shareUpdatedAt: Date }): boolean {
  const { workspace, shareUpdatedAt } = args;
  if (workspace.restoredAt === null) return false;
  return shareUpdatedAt.getTime() < workspace.restoredAt.getTime();
}
