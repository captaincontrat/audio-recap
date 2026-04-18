import type { ShareManagementRefusalReason } from "./errors";

// Management refusal → HTTP status mapping. Mirrors the choices the
// curation surface makes so the API behavior stays consistent across
// transcript-write endpoints:
//
//   - not_found                -> 404 (missing / cross-workspace record)
//   - access_denied            -> 403 (caller is not a workspace member)
//   - forbidden                -> 403 (role does not permit the action)
//   - workspace_archived       -> 409 (active-workspace lockout)
//   - transcript_not_completed -> 409 (state precondition failed)
//   - share_not_enabled        -> 409 (rotate while share is off)
//
// The public-resolve path deliberately has no status map here: every
// refusal on that route collapses to the same 404 "unavailable" page
// per the spec, and the route handler emits that fixed response
// directly instead of mapping per reason.

export function shareManagementRefusalToHttpStatus(reason: ShareManagementRefusalReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "forbidden":
      return 403;
    case "workspace_archived":
      return 409;
    case "transcript_not_completed":
      return 409;
    case "share_not_enabled":
      return 409;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled share management refusal reason: ${String(exhaustive)}`);
    }
  }
}
