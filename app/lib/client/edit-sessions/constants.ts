// Mirror of the server-side edit-session timing constants so the
// client does not need to pull in any server-only module. The values
// are duplicated intentionally - a `server-only` import from a client
// component would break the bundle - but the spec keeps them in
// lockstep with the source of truth under
// `app/lib/server/transcripts/edit-sessions/constants.ts`.

export const AUTOSAVE_DEBOUNCE_MS = 1_000;

export const SESSION_EXPIRY_MS = 20 * 60 * 1_000;

export const RESUME_RECONNECT_WINDOW_MS = 10_000;
