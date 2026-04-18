import type { SessionRefusalReason } from "./errors";

// Centralize the refusal-reason → HTTP status mapping for the edit
// session and autosave routes so the route handlers and the unit tests
// stay in sync. Mapping mirrors the surrounding transcript and
// submission surfaces:
//   - not_found      -> 404 so cross-workspace probes stay hidden
//   - access_denied  -> 403 consistent with workspace access refusal
//   - workspace_archived -> 409 so the UI can branch on lockout
//   - role_not_authorized -> 403 because the caller is authenticated
//     but lacks the write-capable role
//   - already_locked -> 409 because the resource is temporarily owned
//   - session_expired -> 410 since the previously granted session is
//     intentionally gone and cannot be recovered by retrying the same
//     request (the client has to re-enter)

export function editSessionRefusalToHttpStatus(reason: SessionRefusalReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "workspace_archived":
      return 409;
    case "role_not_authorized":
      return 403;
    case "already_locked":
      return 409;
    case "session_expired":
      return 410;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled edit-session refusal reason: ${String(exhaustive)}`);
    }
  }
}
