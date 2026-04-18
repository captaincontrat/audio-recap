import type { TranscriptStatus } from "@/lib/server/db/schema";
import { type CursorPayload, decodeCursor } from "./cursor";
import { type LibrarySortOption, parseLibrarySort } from "./sort-options";

// Normalize the raw library query coming from the API or the page URL
// into a validated shape the repository layer can consume directly.
// Keeps input validation in one place so the route handler, Server
// Component entry point, and tests all apply the same rules.

export const LIBRARY_DEFAULT_PAGE_SIZE = 20;
export const LIBRARY_MAX_PAGE_SIZE = 50;
export const LIBRARY_MAX_SEARCH_LENGTH = 200;

export const LIBRARY_STATUS_FILTER_OPTIONS = [
  "queued",
  "preprocessing",
  "transcribing",
  "generating_recap",
  "generating_title",
  "finalizing",
  "retrying",
  "completed",
  "failed",
] as const satisfies readonly TranscriptStatus[];

export type LibraryRawQuery = {
  search?: string | null;
  sort?: string | null;
  status?: string | null;
  cursor?: string | null;
  limit?: string | number | null;
};

export type LibraryQueryOptions = {
  search: string | null;
  sort: LibrarySortOption;
  status: TranscriptStatus | null;
  cursor: CursorPayload | null;
  limit: number;
};

export type LibraryQueryParseFailureReason = "invalid_sort" | "invalid_status" | "invalid_cursor" | "invalid_limit";

export class LibraryQueryParseError extends Error {
  readonly code = "library_query_invalid" as const;
  readonly reason: LibraryQueryParseFailureReason;
  constructor(reason: LibraryQueryParseFailureReason, message?: string) {
    super(message ?? defaultMessageFor(reason));
    this.name = "LibraryQueryParseError";
    this.reason = reason;
  }
}

function defaultMessageFor(reason: LibraryQueryParseFailureReason): string {
  switch (reason) {
    case "invalid_sort":
      return "Unknown library sort option";
    case "invalid_status":
      return "Unknown library status filter";
    case "invalid_cursor":
      return "Library cursor is malformed or does not match the active sort";
    case "invalid_limit":
      return "Library page size is out of range";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled library query parse failure: ${String(exhaustive)}`);
    }
  }
}

// Parse a raw library query into a validated shape. Throws
// `LibraryQueryParseError` on unknown sort, unknown status, malformed
// cursor, or out-of-range limit so the caller can map the failure to
// the `invalid_query` refusal. Null inputs collapse to the defaults
// (empty search, `newest_first` sort, no status filter, first page).
export function parseLibraryQueryOptions(raw: LibraryRawQuery): LibraryQueryOptions {
  const sort = parseLibrarySort(raw.sort ?? null);
  if (sort === null) {
    throw new LibraryQueryParseError("invalid_sort");
  }

  const status = parseStatusFilter(raw.status ?? null);
  if (status === undefined) {
    throw new LibraryQueryParseError("invalid_status");
  }

  const cursor = parseCursor(raw.cursor ?? null, sort);

  const limit = parseLimit(raw.limit ?? null);

  return {
    search: normalizeSearch(raw.search ?? null),
    sort,
    status,
    cursor,
    limit,
  };
}

function normalizeSearch(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > LIBRARY_MAX_SEARCH_LENGTH) {
    return trimmed.slice(0, LIBRARY_MAX_SEARCH_LENGTH);
  }
  return trimmed;
}

// `undefined` signals "invalid value"; `null` means "no filter" (the
// default when the caller leaves the parameter out).
function parseStatusFilter(value: string | null): TranscriptStatus | null | undefined {
  if (value === null || value === "") return null;
  const match = LIBRARY_STATUS_FILTER_OPTIONS.find((option) => option === value);
  return match ?? undefined;
}

// `decodeCursor` is the only thing that can throw here, and the only
// error it throws today is `CursorDecodeError` (the exhaustive sort
// guard is unreachable once the caller has parsed `sort` through the
// whitelist). Translate every failure into the library's `invalid_cursor`
// family so the route handler can map it to the shared refusal path.
function parseCursor(value: string | null, sort: LibrarySortOption): CursorPayload | null {
  if (value === null || value === "") return null;
  try {
    return decodeCursor(value, sort);
  } catch {
    throw new LibraryQueryParseError("invalid_cursor");
  }
}

function parseLimit(value: string | number | null): number {
  if (value === null || value === "") return LIBRARY_DEFAULT_PAGE_SIZE;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new LibraryQueryParseError("invalid_limit");
  }
  if (parsed > LIBRARY_MAX_PAGE_SIZE) {
    throw new LibraryQueryParseError("invalid_limit");
  }
  return parsed;
}

// Prepare a search query for ILIKE usage by escaping `%` and `_` so a
// typed literal search string behaves like plain text instead of a
// SQL wildcard pattern. The surrounding `%...%` wrapping happens at
// the query layer.
export function escapeSearchForIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
