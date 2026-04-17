// Dedicated error classes for the `meeting-import-processing` capability.
// Callers can match on `instanceof` (route handlers) or on the `.code`
// literal (API response serialisers) to map the failure to the right
// HTTP or UI state.

export type SubmissionRefusalReason =
  | "not_found"
  | "access_denied"
  | "workspace_archived"
  | "role_not_authorized"
  | "media_unsupported"
  | "media_missing"
  | "media_too_large"
  | "notes_too_long"
  | "normalization_required_failed";

export class SubmissionRefusedError extends Error {
  readonly code = "submission_refused" as const;
  readonly reason: SubmissionRefusalReason;
  constructor(reason: SubmissionRefusalReason, message?: string) {
    super(message ?? defaultMessageFor(reason));
    this.name = "SubmissionRefusedError";
    this.reason = reason;
  }
}

// Raised when a status read is refused because the caller cannot see
// the transcript through the narrow post-submit status surface. The
// reason kept deliberately narrow — later transcript-management work
// owns the broader library/detail read surface.
export type StatusReadRefusalReason = "not_found" | "access_denied" | "workspace_archived";

export class StatusReadRefusedError extends Error {
  readonly code = "status_read_refused" as const;
  readonly reason: StatusReadRefusalReason;
  constructor(reason: StatusReadRefusalReason, message?: string) {
    super(message ?? defaultStatusReadMessageFor(reason));
    this.name = "StatusReadRefusedError";
    this.reason = reason;
  }
}

function defaultMessageFor(reason: SubmissionRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Workspace not found";
    case "access_denied":
      return "You do not have access to this workspace";
    case "workspace_archived":
      return "This workspace is archived and cannot accept new submissions";
    case "role_not_authorized":
      return "Your role cannot submit transcripts in this workspace";
    case "media_unsupported":
      return "Media format is not supported";
    case "media_missing":
      return "A meeting media file is required";
    case "media_too_large":
      return "Media file exceeds the allowed upload size";
    case "notes_too_long":
      return "Meeting notes exceed the allowed length";
    case "normalization_required_failed":
      return "Browser-side normalization is required but did not complete";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled submission refusal reason: ${String(exhaustive)}`);
    }
  }
}

function defaultStatusReadMessageFor(reason: StatusReadRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Transcript not found";
    case "access_denied":
      return "You do not have access to this transcript";
    case "workspace_archived":
      return "This workspace is archived and its transcripts are no longer accessible";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled status read refusal reason: ${String(exhaustive)}`);
    }
  }
}
