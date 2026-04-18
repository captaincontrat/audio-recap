// Dedicated error classes for the `private-transcript-library` capability.
// Callers can match on `instanceof` (route handlers) or on the `.code`
// literal (API response serialisers) to map the failure to the right
// HTTP or UI state.
//
// The library and detail read surfaces share the "hide out-of-workspace
// records as not-found" rule from the spec, so both error classes collapse
// access refusals to `not_found` by default. Distinct reasons exist only
// when the UI needs to branch (archived workspace lockout, bad query
// input).

export type LibraryReadRefusalReason = "not_found" | "access_denied" | "workspace_archived" | "invalid_query";

export class LibraryReadRefusedError extends Error {
  readonly code = "library_read_refused" as const;
  readonly reason: LibraryReadRefusalReason;
  constructor(reason: LibraryReadRefusalReason, message?: string) {
    super(message ?? defaultLibraryMessageFor(reason));
    this.name = "LibraryReadRefusedError";
    this.reason = reason;
  }
}

export type DetailReadRefusalReason = "not_found" | "access_denied" | "workspace_archived";

export class DetailReadRefusedError extends Error {
  readonly code = "detail_read_refused" as const;
  readonly reason: DetailReadRefusalReason;
  constructor(reason: DetailReadRefusalReason, message?: string) {
    super(message ?? defaultDetailMessageFor(reason));
    this.name = "DetailReadRefusedError";
    this.reason = reason;
  }
}

// `add-workspace-overview-and-default-landing` reuses the
// private-workspace access model. Inaccessible workspaces collapse to
// `not_found` (so an outsider cannot probe slug existence) and
// archived workspaces surface a distinct reason so the overview can
// render the archived-workspace notice instead of the activity groups.
export type OverviewReadRefusalReason = "not_found" | "access_denied" | "workspace_archived";

export class OverviewReadRefusedError extends Error {
  readonly code = "overview_read_refused" as const;
  readonly reason: OverviewReadRefusalReason;
  constructor(reason: OverviewReadRefusalReason, message?: string) {
    super(message ?? defaultOverviewMessageFor(reason));
    this.name = "OverviewReadRefusedError";
    this.reason = reason;
  }
}

function defaultLibraryMessageFor(reason: LibraryReadRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Workspace not found";
    case "access_denied":
      return "You do not have access to this workspace";
    case "workspace_archived":
      return "This workspace is archived and its transcripts are no longer accessible";
    case "invalid_query":
      return "The library query is invalid";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled library read refusal reason: ${String(exhaustive)}`);
    }
  }
}

function defaultDetailMessageFor(reason: DetailReadRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Transcript not found";
    case "access_denied":
      return "You do not have access to this transcript";
    case "workspace_archived":
      return "This workspace is archived and its transcripts are no longer accessible";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled detail read refusal reason: ${String(exhaustive)}`);
    }
  }
}

function defaultOverviewMessageFor(reason: OverviewReadRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Workspace not found";
    case "access_denied":
      return "You do not have access to this workspace";
    case "workspace_archived":
      return "This workspace is archived";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled overview read refusal reason: ${String(exhaustive)}`);
    }
  }
}
