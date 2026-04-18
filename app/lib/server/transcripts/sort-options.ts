// Library sort contract owned by `add-transcript-management`. The spec
// requires the five sort modes below and reserves `newest_first` as the
// default when no sort is selected. These identifiers are the
// user-facing sort tokens that flow across the library API so the
// server, client, and cursor encoder all agree on the same vocabulary.

export const LIBRARY_SORT_OPTIONS = ["newest_first", "oldest_first", "recently_updated", "title_asc", "title_desc"] as const;

export type LibrarySortOption = (typeof LIBRARY_SORT_OPTIONS)[number];

export const DEFAULT_LIBRARY_SORT: LibrarySortOption = "newest_first";

// Parse an arbitrary input into a known sort token. Returns `null` for
// unknown values so callers can surface a "invalid_query" refusal
// instead of silently coercing to the default (which would make
// typos look like "works but the wrong order").
export function parseLibrarySort(value: string | null | undefined): LibrarySortOption | null {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_LIBRARY_SORT;
  }
  const match = LIBRARY_SORT_OPTIONS.find((option) => option === value);
  return match ?? null;
}

// Whether the sort keys off the stable `displayTitle` field rather than
// one of the time columns. Consumers that need to build cursor payloads
// switch on this to decide whether the boundary value is a string
// (lowercased title) or an ISO timestamp.
export function isTitleSort(sort: LibrarySortOption): boolean {
  return sort === "title_asc" || sort === "title_desc";
}

// Whether the sort orders results in ascending order of its primary
// key. The list API uses this to decide `<` vs `>` keyset comparisons
// when applying a cursor.
export function isAscendingSort(sort: LibrarySortOption): boolean {
  switch (sort) {
    case "newest_first":
    case "recently_updated":
    case "title_desc":
      return false;
    case "oldest_first":
    case "title_asc":
      return true;
    default: {
      const exhaustive: never = sort;
      throw new Error(`Unhandled library sort option: ${String(exhaustive)}`);
    }
  }
}

// The field name the cursor encoder uses as the boundary value tag. The
// API response records the same tag so clients cannot mix cursors from
// different sort modes.
export type LibrarySortColumn = "created_at" | "updated_at" | "title";

export function sortColumnFor(sort: LibrarySortOption): LibrarySortColumn {
  switch (sort) {
    case "newest_first":
    case "oldest_first":
      return "created_at";
    case "recently_updated":
      return "updated_at";
    case "title_asc":
    case "title_desc":
      return "title";
    default: {
      const exhaustive: never = sort;
      throw new Error(`Unhandled library sort option: ${String(exhaustive)}`);
    }
  }
}
