import type { WorkspaceRole } from "@/lib/server/db/schema";

import { RESUME_RECONNECT_WINDOW_MS, SESSION_EXPIRY_MS } from "./constants";
import type { SessionRefusalReason } from "./errors";

// Pure decision logic for the transcript edit-session capability. The
// Redis-touching primitives and API routes compose these predicates so
// the product rules (role gating, lock conflict handling, same-tab
// resume rules, expiry windows) have a single unit-testable source of
// truth.

// Roles allowed to acquire a markdown edit session. `read_only` users
// can load the transcript read surface but MUST NOT acquire the write
// lock. Keeping the allow-list literal means new roles cannot silently
// gain edit privileges.
const EDIT_CAPABLE_ROLES: ReadonlySet<WorkspaceRole> = new Set<WorkspaceRole>(["member", "admin"]);

export function canRoleEditMarkdown(role: WorkspaceRole): boolean {
  return EDIT_CAPABLE_ROLES.has(role);
}

// Inputs a caller must resolve before attempting to enter an edit
// session: the caller's workspace role, whether the workspace is still
// active, whether another session already holds the lock, and - when
// another session is present - the tab identity that owns it so a
// same-tab re-entry can be distinguished from a cross-tab conflict.
export type EnterSessionInputs = {
  role: WorkspaceRole;
  workspaceActive: boolean;
  activeSession: ActiveSessionSummary | null;
  requestingTabId: string;
};

// Summary of the currently active lock (if any). Kept intentionally
// narrow so the decision function does not depend on Redis value
// shapes.
export type ActiveSessionSummary = {
  tabId: string;
  userId: string;
};

export type EnterSessionDecision = { kind: "accepted" } | { kind: "resume"; tabId: string } | { kind: "refused"; reason: EnterSessionRefusalReason };

// Subset of `SessionRefusalReason` values the enter-session decision
// can return. Not every refusal reason applies at entry - for example
// `session_expired` only matters for autosave and resume requests.
export type EnterSessionRefusalReason = Extract<SessionRefusalReason, "workspace_archived" | "role_not_authorized" | "already_locked">;

// Decide whether the caller may enter markdown edit mode. Refusal
// ordering mirrors the submission-decisions module so tests and the UI
// observe the same precedence:
//   1. workspace archived (owned by `add-workspace-archival-lifecycle`)
//   2. role cannot write (owned by this capability)
//   3. another active session already holds the lock
// A same-tab re-entry returns `{ kind: "resume" }` so the caller can
// take the dedicated resume path instead of issuing a new lock.
export function evaluateEnterSession(inputs: EnterSessionInputs): EnterSessionDecision {
  if (!inputs.workspaceActive) {
    return { kind: "refused", reason: "workspace_archived" };
  }
  if (!canRoleEditMarkdown(inputs.role)) {
    return { kind: "refused", reason: "role_not_authorized" };
  }
  if (inputs.activeSession) {
    if (inputs.activeSession.tabId === inputs.requestingTabId) {
      return { kind: "resume", tabId: inputs.activeSession.tabId };
    }
    return { kind: "refused", reason: "already_locked" };
  }
  return { kind: "accepted" };
}

// Inputs a caller must resolve to decide whether a refreshed tab can
// resume its existing edit session. The caller supplies the lock
// snapshot (if any), the identity the client presents, the session's
// last-saved moment, and the current moment. All timing values are
// milliseconds since the unix epoch so the decision stays testable
// without a clock.
export type ResumeSessionInputs = {
  workspaceActive: boolean;
  activeSession: ActiveSessionSummary | null;
  requestingTabId: string;
  requestingUserId: string;
  // Moment the last heartbeat (entry or successful autosave) was
  // accepted. The reconnect window is measured from this value.
  lastHeartbeatAt: number | null;
  // Current moment for the decision. Injected so tests can pin it.
  now: number;
};

export type ResumeSessionDecision = { kind: "resumed" } | { kind: "refused"; reason: ResumeSessionRefusalReason };

// Resume can fail for three spec-defined reasons:
//   - the reconnection window elapsed / lock no longer matches
//   - the workspace was archived while the tab was reloading
//   - another caller (different tab or different user) holds the lock
export type ResumeSessionRefusalReason = Extract<SessionRefusalReason, "workspace_archived" | "session_expired" | "already_locked">;

// Decide whether a refreshed tab can resume an active session. The
// caller is expected to have already authenticated and resolved the
// workspace context - this function only evaluates the session-specific
// rules.
//
// Refusal ordering:
//   1. workspace archived takes precedence over everything else
//   2. no active session, or the session belongs to another user -
//      collapse to `session_expired` so a reloaded tab cannot probe
//      who currently holds the lock
//   3. a different tab of the same user holds the lock -> `already_locked`
//   4. the reconnect window has elapsed since the last heartbeat
//      -> `session_expired`
export function evaluateResumeSession(inputs: ResumeSessionInputs): ResumeSessionDecision {
  if (!inputs.workspaceActive) {
    return { kind: "refused", reason: "workspace_archived" };
  }
  if (!inputs.activeSession) {
    return { kind: "refused", reason: "session_expired" };
  }
  if (inputs.activeSession.userId !== inputs.requestingUserId) {
    // The lock belongs to a different user. The caller cannot see
    // whose tab owns it, so collapse to the stale-session outcome
    // and let them follow the lock-loss UI path.
    return { kind: "refused", reason: "session_expired" };
  }
  if (inputs.activeSession.tabId !== inputs.requestingTabId) {
    return { kind: "refused", reason: "already_locked" };
  }
  if (inputs.lastHeartbeatAt === null) {
    return { kind: "refused", reason: "session_expired" };
  }
  if (inputs.now - inputs.lastHeartbeatAt > RESUME_RECONNECT_WINDOW_MS) {
    return { kind: "refused", reason: "session_expired" };
  }
  return { kind: "resumed" };
}

// Inputs the autosave decision needs: the snapshot of the active lock,
// the caller's identity + lock token, the workspace activity flag, and
// the moment of the attempt. Callers pass the Redis-resolved lock
// token so we can check it matches without ever leaking the value
// beyond this boundary.
export type AutosaveInputs = {
  workspaceActive: boolean;
  activeSession:
    | (ActiveSessionSummary & {
        lockToken: string;
        lastHeartbeatAt: number;
      })
    | null;
  requestingTabId: string;
  requestingUserId: string;
  requestingLockToken: string;
  now: number;
};

export type AutosaveDecision = { kind: "accepted"; nextHeartbeatAt: number } | { kind: "refused"; reason: AutosaveRefusalReason };

// Autosave can be refused for the same reasons as resume, plus the
// archive lockout from the workspace-archival-lifecycle capability.
export type AutosaveRefusalReason = Extract<SessionRefusalReason, "workspace_archived" | "session_expired">;

// Decide whether the autosave request should be persisted. The
// `nextHeartbeatAt` output is the value the caller must stamp on the
// lock when renewing so all heartbeat math stays here.
//
// Refusal ordering:
//   1. workspace archived
//   2. no active session, or the session belongs to another user, or
//      the lock token the client presents does not match, or the tab
//      identity does not match, or the expiry window has elapsed -
//      all collapse to `session_expired` since the client must re-enter
export function evaluateAutosave(inputs: AutosaveInputs): AutosaveDecision {
  if (!inputs.workspaceActive) {
    return { kind: "refused", reason: "workspace_archived" };
  }
  const session = inputs.activeSession;
  if (!session) {
    return { kind: "refused", reason: "session_expired" };
  }
  if (session.userId !== inputs.requestingUserId) {
    return { kind: "refused", reason: "session_expired" };
  }
  if (session.tabId !== inputs.requestingTabId) {
    return { kind: "refused", reason: "session_expired" };
  }
  if (session.lockToken !== inputs.requestingLockToken) {
    return { kind: "refused", reason: "session_expired" };
  }
  if (inputs.now - session.lastHeartbeatAt > SESSION_EXPIRY_MS) {
    return { kind: "refused", reason: "session_expired" };
  }
  return { kind: "accepted", nextHeartbeatAt: inputs.now };
}

// Compute the Redis TTL (in seconds, rounded up) corresponding to the
// configured session expiry. Pulled into a helper so the acquisition
// and renewal paths stay in sync with the decision logic above.
export function sessionExpirySeconds(): number {
  return Math.ceil(SESSION_EXPIRY_MS / 1_000);
}
