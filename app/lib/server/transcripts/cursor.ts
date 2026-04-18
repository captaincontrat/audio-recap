import type { LibrarySortColumn, LibrarySortOption } from "./sort-options";
import { sortColumnFor } from "./sort-options";

// Opaque cursor the library uses to page through transcripts. The
// server encodes `(boundaryValue, id, sortColumn)` so that changing the
// sort mode invalidates any in-flight cursors — the client must reset
// pagination when query controls change, and the `sort` tag baked into
// the cursor is the server-side guarantee of that rule.
//
// Cursor values are not secrets, but they must not carry column
// contents that the callee does not already see (transcript id and the
// sort boundary are fine). Encoding is base64url of a compact JSON
// object; callers treat the cursor as an opaque string.

export type CursorPayload = {
  // Column the boundary value refers to. Prevents mixing a time cursor
  // with a title cursor or vice versa.
  column: LibrarySortColumn;
  // ISO-8601 timestamp for time columns, lowercased `title` string for
  // title sorts. Kept as a string so the payload round-trips through
  // JSON without losing precision.
  value: string;
  // Tie-breaker id. Keyset pagination is only stable if the sort keys
  // include a unique tail column; we always sort by transcript id as
  // the secondary key.
  id: string;
};

export class CursorDecodeError extends Error {
  readonly code = "cursor_decode_failed" as const;
  constructor(message = "Cursor is malformed or expired") {
    super(message);
    this.name = "CursorDecodeError";
  }
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return toBase64Url(json);
}

// Decode a cursor and validate that its sort column matches the active
// library sort. Mismatches throw so the server can translate them into
// the `invalid_query` refusal reason instead of silently returning a
// wrong page.
export function decodeCursor(token: string, expectedSort: LibrarySortOption): CursorPayload {
  const decoded = safeParseBase64Url(token);
  if (!decoded) {
    throw new CursorDecodeError();
  }
  const payload = parseCursorJson(decoded);
  if (!payload) {
    throw new CursorDecodeError();
  }
  if (payload.column !== sortColumnFor(expectedSort)) {
    throw new CursorDecodeError("Cursor does not match the active sort");
  }
  return payload;
}

function parseCursorJson(raw: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const column = (parsed as Record<string, unknown>).column;
    const value = (parsed as Record<string, unknown>).value;
    const id = (parsed as Record<string, unknown>).id;
    if (typeof column !== "string") return null;
    if (typeof value !== "string") return null;
    if (typeof id !== "string" || id.length === 0) return null;
    if (column !== "created_at" && column !== "updated_at" && column !== "title") {
      return null;
    }
    return { column, value, id };
  } catch {
    return null;
  }
}

function toBase64Url(raw: string): string {
  // Node and browser `Buffer` vs `btoa` both support utf-8 strings via
  // `Buffer.from(str)` and `btoa(unescape(...))` respectively; the
  // server-side encoder is always Node here, so use `Buffer`.
  const base64 = Buffer.from(raw, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// `Buffer.from(badBase64, "base64")` is lenient in Node and does not
// throw on garbage input -- it returns whatever it can decode. The
// catch is defensive for runtime surprises (e.g. future Node versions
// tightening the decoder) and cannot be exercised today.
function safeParseBase64Url(token: string): string | null {
  if (token.length === 0) return null;
  const padLength = (4 - (token.length % 4)) % 4;
  const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    /* v8 ignore next */
    return null;
  }
}
