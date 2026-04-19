// User-facing copy for the limited set of `MeetingSubmissionError`
// codes the upload entry points can surface. Keeping the mapping in
// one place means the dedicated `/meetings/new` form, the drop
// overlay, the header upload control, and the tray itself all read
// the same wording when they re-use the shared submission helper.
//
// Codes the dedicated form mapped against `normalizationPolicy`
// ("required" vs "optional") are collapsed here to a single message
// because the shell entry points do not currently know the workspace
// policy at the moment a draft is built. The dedicated form keeps
// its policy-aware override for the policy banner, but the tray
// surfaces the generic message and points the user at the dedicated
// form for the recovery action.

export function describeSubmissionErrorCode(code: string, fallback: string): string {
  switch (code) {
    case "access_denied":
      return "You do not have access to submit meetings in this workspace.";
    case "role_not_authorized":
      return "Your role in this workspace does not allow submitting meetings.";
    case "workspace_archived":
      return "This workspace is archived and cannot accept new submissions.";
    case "media_too_large":
      return "This file is larger than the 500 MB per-submission limit.";
    case "media_unsupported":
      return "Only audio or video files are supported.";
    case "notes_too_long":
      return "Meeting notes exceed the 64 KB limit.";
    case "media_missing":
    case "empty_file":
      return "The upload did not complete. Please retry.";
    case "normalization_required_failed":
      // Phrased to stay truthful for both code paths on supported
      // browsers: the conversion did not run at all (`unavailable`)
      // and the conversion ran and failed for this file (`failed`).
      // The dedicated form layers a policy-aware override on top
      // when the workspace has flipped to `required` mode.
      return "Browser-side MP3 conversion did not succeed. Try Chrome or Edge, or ask an admin to relax the policy.";
    case "plan_token_expired":
      return "The upload session expired. Please start again.";
    case "plan_token_invalid_signature":
    case "plan_token_malformed":
    case "plan_token_user_mismatch":
    case "plan_token_version_mismatch":
      return "The upload session is no longer valid. Please start again.";
    case "upload_failed":
      return "Upload to transient storage failed. Please retry in a moment.";
    case "unexpected_response":
      return "Unexpected response from the server. Please retry.";
    default:
      return fallback;
  }
}
