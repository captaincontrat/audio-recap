import { randomBytes } from "node:crypto";

// Short opaque identifiers used by the transcript edit-session
// capability. The generator mirrors the meetings/auth helpers so
// downstream grep for an id prefix is enough to find the owning module.
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomId(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    // `randomBytes(length)` always returns a Buffer of exactly `length`
    // bytes, so the `?? 0` fallback only exists to satisfy
    // noUncheckedIndexedAccess and is unreachable at runtime.
    /* v8 ignore next */
    const byte = bytes[i] ?? 0;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

// Client-generated tab identity. The server trusts this as the
// tab-scoped session identity for same-tab resume but never as a proof
// of lock ownership - `lockToken` is authoritative for mutations. Tab
// ids stay on the client across reloads in `sessionStorage` so a
// browser refresh can present the same identity.
export function generateTabSessionId(): string {
  return `tab_${randomId(20)}`;
}

// Server-issued opaque token. Acquiring or resuming a session returns
// a fresh token; every autosave and renewal must present it so a
// stolen or replayed request from a different tab cannot drive the
// session forward.
export function generateLockToken(): string {
  return `lock_${randomId(28)}`;
}
