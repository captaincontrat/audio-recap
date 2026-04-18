// Barrel for the client-side edit-session module. Importers should
// reach in through this entry point so the file layout can evolve
// without breaking the detail view or future callers.

export {
  autosaveEditSession,
  type EditSessionContext,
  EditSessionNetworkError,
  type EditSessionRefusalReason,
  EditSessionRefusedError,
  enterEditSession,
  exitEditSession,
  resumeEditSession,
} from "./client";

export { AUTOSAVE_DEBOUNCE_MS, RESUME_RECONNECT_WINDOW_MS, SESSION_EXPIRY_MS } from "./constants";

export { clearStoredTabSessionId, ensureTabSessionId, readStoredTabSessionId } from "./tab-identity";

export { type EditDraft, type EditSessionStatus, useEditSession } from "./use-edit-session";
