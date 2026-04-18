// Dedicated error classes for the `add-public-transcript-sharing`
// capability. The management and public-resolve paths use separate
// error types because their refusal vocabularies diverge:
//
//   - `ShareManagementRefusedError` is surfaced to authenticated
//     members/admins invoking enable/disable/rotate and carries the
//     specific reason so the UI can explain why an action failed.
//   - `PublicShareResolutionRefusedError` is surfaced to the
//     unauthenticated `/share/<id>/<secret>` route and is
//     intentionally reason-coarse because every failure mode
//     collapses to the same generic "unavailable" presentation per
//     the spec: the public route must never reveal whether a
//     transcript exists, used to be shared, or was rotated.
//
// The internal `reason` on the public error stays rich so the
// server can log _why_ a request was refused without letting that
// detail leak into the rendered response.

export type ShareManagementRefusalReason =
  // Transcript does not live in the caller's workspace, or it has
  // been deleted. Collapsed with cross-workspace lookups per the
  // same "hide cross-workspace records as not-found" contract the
  // curation services follow.
  | "not_found"
  // The workspace itself is missing or the caller is not a member.
  | "access_denied"
  // Caller's workspace role does not permit share management
  // (only `member` and `admin` may manage shares).
  | "forbidden"
  // Active-workspace gate from `add-workspace-archival-lifecycle`.
  | "workspace_archived"
  // Share management requires the transcript to be in `completed`
  // status so the public page can serve stable canonical markdown.
  // Any earlier status (queued, processing, failed) is refused.
  | "transcript_not_completed"
  // Rotation requires an already-enabled share. Attempts to rotate
  // while the share is off receive this refusal instead of a
  // silent re-enable because the management UI ought to surface the
  // state mismatch.
  | "share_not_enabled";

export class ShareManagementRefusedError extends Error {
  readonly code = "share_management_refused" as const;
  readonly reason: ShareManagementRefusalReason;
  constructor(reason: ShareManagementRefusalReason, message?: string) {
    super(message ?? defaultManagementMessageFor(reason));
    this.name = "ShareManagementRefusedError";
    this.reason = reason;
  }
}

// Reasons the server records internally when refusing a public-
// route request. Every value maps to the same client-visible
// "unavailable" presentation; they exist only so logs can explain
// the refusal family.
export type PublicShareResolutionRefusalReason =
  // No transcript has this `publicShareId` at all.
  | "unknown_share_id"
  // The URL's secret segment does not match the currently active
  // rotation for this transcript (rotated out, or never correct).
  | "secret_mismatch"
  // Share is currently disabled in this workspace.
  | "share_disabled"
  // Transcript is no longer in `completed` status (e.g. deleted or
  // reset). The management service rejects non-completed enables
  // but a stored row could still exist from earlier state; the
  // public route re-checks here to stay safe.
  | "transcript_not_completed"
  // Workspace is not currently active for public sharing — either
  // archived, or restored but the share has not been touched since
  // restore (see `isShareSuppressedByRestore`).
  | "workspace_inactive";

export class PublicShareResolutionRefusedError extends Error {
  readonly code = "public_share_unavailable" as const;
  readonly reason: PublicShareResolutionRefusalReason;
  constructor(reason: PublicShareResolutionRefusalReason, message?: string) {
    // The message is for internal logs only. The public response
    // uses a generic fixed copy so this text must never reach the
    // HTTP body.
    super(message ?? `public_share_unavailable:${reason}`);
    this.name = "PublicShareResolutionRefusedError";
    this.reason = reason;
  }
}

function defaultManagementMessageFor(reason: ShareManagementRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Transcript not found";
    case "access_denied":
      return "You do not have access to this workspace";
    case "forbidden":
      return "Your workspace role does not allow managing public sharing";
    case "workspace_archived":
      return "This workspace is archived and share management is disabled";
    case "transcript_not_completed":
      return "Only completed transcripts can be shared publicly";
    case "share_not_enabled":
      return "Public sharing is not currently enabled for this transcript";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled share management refusal reason: ${String(exhaustive)}`);
    }
  }
}
