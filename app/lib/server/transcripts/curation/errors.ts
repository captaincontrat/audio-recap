// Dedicated error classes for the `transcript-curation-controls`
// capability. The route handlers map these to a stable HTTP response
// shape via `curation-http-status.ts`. Keeping the patch and delete
// refusals in one module makes the "hide cross-workspace records as
// not-found" contract easy to audit: both classes collapse access
// refusals to `not_found` rather than surfacing distinct
// forbidden/missing states across workspace boundaries.

export type PatchRefusalReason =
  // Collapsed from "missing transcript" and "out-of-workspace
  // transcript" per the spec: curation requests for records that do
  // not live in the current workspace return the same not-found shape
  // as a missing id so the surface cannot be used to probe other
  // workspaces.
  | "not_found"
  // The workspace itself is missing or the caller is not a member.
  // Distinct from `not_found` only so the UI can surface a "workspace
  // unavailable" view instead of a per-record not-found.
  | "access_denied"
  // The caller's workspace role does not permit curation writes
  // (read_only attempting a patch).
  | "forbidden"
  // Active-workspace gate from `add-workspace-archival-lifecycle`.
  | "workspace_archived"
  // The patch body failed validation (bad tag shape, over-long title,
  // empty patch, etc). The error message carries the specific
  // validation reason for clients that want to show a targeted inline
  // error.
  | "invalid_patch";

export class PatchRefusedError extends Error {
  readonly code = "curation_patch_refused" as const;
  readonly reason: PatchRefusalReason;
  constructor(reason: PatchRefusalReason, message?: string) {
    super(message ?? defaultPatchMessageFor(reason));
    this.name = "PatchRefusedError";
    this.reason = reason;
  }
}

export type DeleteRefusalReason = "not_found" | "access_denied" | "forbidden" | "workspace_archived";

export class DeleteRefusedError extends Error {
  readonly code = "curation_delete_refused" as const;
  readonly reason: DeleteRefusalReason;
  constructor(reason: DeleteRefusalReason, message?: string) {
    super(message ?? defaultDeleteMessageFor(reason));
    this.name = "DeleteRefusedError";
    this.reason = reason;
  }
}

function defaultPatchMessageFor(reason: PatchRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Transcript not found";
    case "access_denied":
      return "You do not have access to this workspace";
    case "forbidden":
      return "Your workspace role does not allow editing this transcript";
    case "workspace_archived":
      return "This workspace is archived and curation changes are disabled";
    case "invalid_patch":
      return "The patch body is invalid";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled curation patch refusal reason: ${String(exhaustive)}`);
    }
  }
}

function defaultDeleteMessageFor(reason: DeleteRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Transcript not found";
    case "access_denied":
      return "You do not have access to this workspace";
    case "forbidden":
      return "You cannot delete this transcript";
    case "workspace_archived":
      return "This workspace is archived and curation changes are disabled";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled curation delete refusal reason: ${String(exhaustive)}`);
    }
  }
}
