// Tab-scoped identity helpers for transcript edit sessions.
//
// The spec requires "one active edit session per transcript, with a
// same-tab reload being able to resume within a reconnection window".
// We key the identity off `sessionStorage` so:
//   - Two tabs opened by the same user see different identities and
//     the second one is refused as a conflict.
//   - A browser refresh keeps the same identity, so the server can
//     tell "this is the same tab coming back" apart from "a second
//     tab stealing the lock".
//
// The storage key is namespaced per transcript so leaving one
// transcript and entering another does not inherit a stale id.

const STORAGE_KEY_PREFIX = "transcript-edit-session:tab:";

function storageKeyFor(transcriptId: string): string {
  return `${STORAGE_KEY_PREFIX}${transcriptId}`;
}

// Generate a short opaque id suitable for HTTP payloads. Both the
// browser runtime and the jsdom test environment expose
// `crypto.getRandomValues`, so we rely on it directly and let any
// exotic runtime (e.g. SSR without `globalThis.crypto`) surface its
// own failure rather than silently falling back to `Math.random`.
function generateTabSessionId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    // `Uint8Array` fixed-length construction means every index is
    // populated; the `?? 0` keeps `noUncheckedIndexedAccess` happy.
    /* v8 ignore next */
    const byte = bytes[i] ?? 0;
    out += alphabet[byte % alphabet.length];
  }
  return `tab_${out}`;
}

// Load the existing tab id (after a browser refresh), or issue + store
// a fresh one. Returns a stable identity for the life of the tab.
export function ensureTabSessionId(transcriptId: string): string {
  const key = storageKeyFor(transcriptId);
  const existing = window.sessionStorage.getItem(key);
  if (existing?.startsWith("tab_")) {
    return existing;
  }
  const fresh = generateTabSessionId();
  window.sessionStorage.setItem(key, fresh);
  return fresh;
}

// Returns the existing tab id without creating a new one. Used before
// the first enter request to decide whether the page load is a fresh
// start or a reload of an earlier edit session that may still be
// resumable.
export function readStoredTabSessionId(transcriptId: string): string | null {
  return window.sessionStorage.getItem(storageKeyFor(transcriptId));
}

export function clearStoredTabSessionId(transcriptId: string): void {
  window.sessionStorage.removeItem(storageKeyFor(transcriptId));
}
