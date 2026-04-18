import type { TranscriptStatus } from "@/lib/server/db/schema";
import { type CursorPayload, decodeCursor } from "./cursor";
import { MAX_TAG_COUNT, MAX_TAG_LENGTH } from "./curation/validation";
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

// The tag filter cap mirrors `MAX_TAG_COUNT` (a transcript can carry
// at most N tags, so it makes no sense to accept more filter entries
// than that). Shared constant so the query-options module and callers
// agree on the same ceiling.
export const LIBRARY_MAX_TAG_FILTER_COUNT = MAX_TAG_COUNT;

export type LibraryImportantFilter = boolean | null;
// `add-public-transcript-sharing` shares the same tri-state shape
// (`null` = no filter, `true`/`false` = restrict). Kept as a named
// alias so call sites read as "shared filter" not "bool-or-null".
export type LibrarySharedFilter = boolean | null;

export type LibraryRawQuery = {
  search?: string | null;
  sort?: string | null;
  status?: string | null;
  cursor?: string | null;
  limit?: string | number | null;
  // `add-transcript-curation-controls` adds important-state and
  // tag-list filtering. `important` is the string form the URL uses;
  // `tags` accepts either a single value (`?tags=kickoff`) or an array
  // (`?tags=kickoff&tags=planning`). A missing key means "no filter".
  important?: string | null;
  tags?: string | string[] | null;
  // `add-public-transcript-sharing` adds a shared/unshared filter.
  // Expects the string form `"true"` / `"false"`; a missing or empty
  // value means "no filter" and any other string is rejected with
  // `invalid_shared` so typos do not silently degrade to "all".
  shared?: string | null;
};

export type LibraryQueryOptions = {
  search: string | null;
  sort: LibrarySortOption;
  status: TranscriptStatus | null;
  cursor: CursorPayload | null;
  limit: number;
  important: LibraryImportantFilter;
  tags: string[];
  shared: LibrarySharedFilter;
};

export type LibraryQueryParseFailureReason =
  | "invalid_sort"
  | "invalid_status"
  | "invalid_cursor"
  | "invalid_limit"
  | "invalid_important"
  | "invalid_tags"
  | "invalid_shared";

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
    case "invalid_important":
      return "Important filter must be 'true' or 'false'";
    case "invalid_tags":
      return `Tag filter must be an array of up to ${LIBRARY_MAX_TAG_FILTER_COUNT} non-empty values`;
    case "invalid_shared":
      return "Shared filter must be 'true' or 'false'";
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
// (empty search, `newest_first` sort, no status filter, first page,
// no curation filters).
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

  const important = parseImportantFilter(raw.important ?? null);
  const tags = parseTagsFilter(raw.tags ?? null);
  const shared = parseSharedFilter(raw.shared ?? null);

  return {
    search: normalizeSearch(raw.search ?? null),
    sort,
    status,
    cursor,
    limit,
    important,
    tags,
    shared,
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

// `null` means "no filter" (default). `true` / `false` restrict the
// library to records with that important state. Any other value is
// rejected so typos do not silently degrade to "all records".
function parseImportantFilter(value: string | null): LibraryImportantFilter {
  if (value === null || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new LibraryQueryParseError("invalid_important");
}

// Mirror of `parseImportantFilter` for the share-state filter. The
// tri-state is "no filter" (null) / "shared only" (true) / "unshared
// only" (false). Kept as a dedicated helper so the refusal reason
// points to the correct parameter instead of reusing the important
// code when the user typoed `?shared=yes`.
function parseSharedFilter(value: string | null): LibrarySharedFilter {
  if (value === null || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new LibraryQueryParseError("invalid_shared");
}

// Accepts a single scalar or an array of tag strings. Each entry is
// normalized the same way the curation writer normalizes tags (trim,
// lowercase, length-bounded), then deduplicated so `?tags=kickoff&tags=Kickoff`
// collapses to one filter. An empty result means the caller did not
// supply any tag filter; the repository layer then skips the filter.
// Rejects non-strings, empty-after-normalization values, over-long
// tags, and more than `LIBRARY_MAX_TAG_FILTER_COUNT` entries.
function parseTagsFilter(value: string | string[] | null): string[] {
  if (value === null) return [];
  const raw = Array.isArray(value) ? value : [value];
  if (raw.length === 0) return [];
  if (raw.length > LIBRARY_MAX_TAG_FILTER_COUNT) {
    throw new LibraryQueryParseError("invalid_tags");
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") {
      throw new LibraryQueryParseError("invalid_tags");
    }
    const tag = entry.trim().toLowerCase();
    if (tag.length === 0) {
      throw new LibraryQueryParseError("invalid_tags");
    }
    if (tag.length > MAX_TAG_LENGTH) {
      throw new LibraryQueryParseError("invalid_tags");
    }
    if (seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }
  if (normalized.length > LIBRARY_MAX_TAG_FILTER_COUNT) {
    throw new LibraryQueryParseError("invalid_tags");
  }
  return normalized;
}

// Prepare a search query for ILIKE usage by escaping `%` and `_` so a
// typed literal search string behaves like plain text instead of a
// SQL wildcard pattern. The surrounding `%...%` wrapping happens at
// the query layer.
export function escapeSearchForIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
