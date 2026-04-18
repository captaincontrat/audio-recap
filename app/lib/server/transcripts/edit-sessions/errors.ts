// Dedicated error classes for the `transcript-edit-sessions` capability.
// Every refusal the client can observe flows through `SessionRefusedError`
// so the API layer has one enum to branch on when turning a server
// refusal into an HTTP status or a client-side UI state.
//
// The reason vocabulary mirrors the spec:
//   - `not_found` / `access_denied` collapse cross-workspace probes to
//     the same "transcript is unavailable" response the library and
//     detail reads already emit.
//   - `workspace_archived` is the archived-workspace lockout owned by
//     `add-workspace-archival-lifecycle`.
//   - `role_not_authorized` blocks `read_only` callers from acquiring
//     markdown edit sessions.
//   - `already_locked` blocks a second user (or the same user in a
//     different tab) from grabbing an active lock.
//   - `session_expired` is the stale-session outcome for resume and
//     autosave requests once the underlying lock has been lost or
//     replaced.

export type SessionRefusalReason = "not_found" | "access_denied" | "workspace_archived" | "role_not_authorized" | "already_locked" | "session_expired";

export class SessionRefusedError extends Error {
  readonly code = "edit_session_refused" as const;
  readonly reason: SessionRefusalReason;
  constructor(reason: SessionRefusalReason, message?: string) {
    super(message ?? defaultMessageFor(reason));
    this.name = "SessionRefusedError";
    this.reason = reason;
  }
}

function defaultMessageFor(reason: SessionRefusalReason): string {
  switch (reason) {
    case "not_found":
      return "Transcript not found";
    case "access_denied":
      return "You do not have access to this transcript";
    case "workspace_archived":
      return "This workspace is archived and transcript editing is unavailable";
    case "role_not_authorized":
      return "Your role cannot edit transcript markdown in this workspace";
    case "already_locked":
      return "Another edit session is already active for this transcript";
    case "session_expired":
      return "Your edit session has expired and must be re-entered";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled edit-session refusal reason: ${String(exhaustive)}`);
    }
  }
}
