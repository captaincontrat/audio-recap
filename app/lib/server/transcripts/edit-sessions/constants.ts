// Timing constants shared between the server lock primitives, the
// archive side effect, the client edit-session manager, and their tests.
// Centralizing the values means the server-enforced expiry, the client
// autosave debounce, and the resume window all stay in lockstep with
// the `add-transcript-edit-sessions` spec.

// Debounce the client waits after a markdown change before issuing an
// autosave. The spec calls for "approximately one second"; the server
// does not enforce this directly but reads it here so tests can
// exercise the same value.
export const AUTOSAVE_DEBOUNCE_MS = 1_000;

// Maximum lifetime of an edit session measured from the last
// successful save. The server stamps Redis TTLs with this value so a
// missing heartbeat lets the lock expire without manual teardown.
export const SESSION_EXPIRY_MS = 20 * 60 * 1_000;

// Window the server accepts same-tab resume attempts within after a
// browser reload. The spec requires "approximately 10 seconds"; the
// lock remains live during this window so the refreshed tab can claim
// it back by presenting the same tab-scoped identity.
export const RESUME_RECONNECT_WINDOW_MS = 10_000;

// Fields the edit lock protects. Metadata-only actions (rename, tags,
// important toggle, share state) deliberately sit outside this set so
// they do not serialize on the markdown editing session.
export const EDIT_LOCK_FIELDS = ["transcriptMarkdown", "recapMarkdown"] as const;

export type EditLockField = (typeof EDIT_LOCK_FIELDS)[number];
