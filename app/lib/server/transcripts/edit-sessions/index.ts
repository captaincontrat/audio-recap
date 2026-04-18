// Barrel re-exports for the `transcript-edit-sessions` capability.
// Upstream route handlers, client glue, workspace bootstrap wiring,
// and tests should import through this module so the capability can
// evolve its file layout without breaking downstream call sites.

export {
  EDIT_SESSIONS_ARCHIVE_EFFECT_ID,
  editSessionsArchiveSideEffect,
  registerEditSessionsArchiveSideEffect,
  unregisterEditSessionsArchiveSideEffect,
} from "./archive-side-effect";

export {
  AUTOSAVE_DEBOUNCE_MS,
  EDIT_LOCK_FIELDS,
  type EditLockField,
  RESUME_RECONNECT_WINDOW_MS,
  SESSION_EXPIRY_MS,
} from "./constants";

export { type SessionRefusalReason, SessionRefusedError } from "./errors";

export { editSessionRefusalToHttpStatus } from "./http-status";

export { generateLockToken, generateTabSessionId } from "./ids";

export {
  acquireLock,
  type AcquireInput,
  type AcquireResult,
  inspectLock,
  listActiveLocksForWorkspace,
  type LockSnapshot,
  releaseAllLocksForWorkspace,
  releaseLock,
  type ReleaseInput,
  renewLock,
  type RenewInput,
  sessionExpirySeconds,
  type StoredLock,
} from "./locks";

export { buildUpdateValues, type MarkdownSavePatch, persistMarkdownSave, sanitizeMarkdownPatch } from "./persistence";

export {
  type ActiveSessionSummary,
  type AutosaveDecision,
  type AutosaveInputs as AutosaveDecisionInputs,
  type AutosaveRefusalReason,
  canRoleEditMarkdown,
  type EnterSessionDecision,
  type EnterSessionInputs as EnterSessionDecisionInputs,
  type EnterSessionRefusalReason,
  evaluateAutosave,
  evaluateEnterSession,
  evaluateResumeSession,
  type ResumeSessionDecision,
  type ResumeSessionInputs as ResumeSessionDecisionInputs,
  type ResumeSessionRefusalReason,
} from "./session-decisions";

export {
  type AutosaveInputs,
  type AutosaveResult,
  autosaveMarkdown,
  type EditSessionContext,
  type EnterSessionInputs,
  enterEditSession,
  type ExitSessionInputs,
  exitEditSession,
  type ResumeSessionInputs,
  resumeEditSession,
} from "./session-service";
