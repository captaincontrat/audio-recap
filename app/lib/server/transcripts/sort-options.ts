// Library sort contract. The base sort modes come from
// `add-transcript-management`; the curation extension adds
// important-state and tag-aware sorts. `newest_first` remains the
// default when no sort is selected. These identifiers are the
// user-facing sort tokens that flow across the library API so the
// server, client, and cursor encoder all agree on the same vocabulary.

export const LIBRARY_SORT_OPTIONS = [
  "newest_first",
  "oldest_first",
  "recently_updated",
  "title_asc",
  "title_desc",
  // Curation extensions (`add-transcript-curation-controls`):
  "important_first",
  "important_last",
  "tag_list_asc",
  "tag_list_desc",
] as const;

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
// when applying a cursor. For composite sorts, "ascending" refers to
// the primary key only:
//   - `important_first` / `tag_list_desc` -> descending
//   - `important_last`  / `tag_list_asc`  -> ascending
export function isAscendingSort(sort: LibrarySortOption): boolean {
  switch (sort) {
    case "newest_first":
    case "recently_updated":
    case "title_desc":
    case "important_first":
    case "tag_list_desc":
      return false;
    case "oldest_first":
    case "title_asc":
    case "important_last":
    case "tag_list_asc":
      return true;
    default: {
      const exhaustive: never = sort;
      throw new Error(`Unhandled library sort option: ${String(exhaustive)}`);
    }
  }
}

// The field name the cursor encoder uses as the boundary value tag. The
// API response records the same tag so clients cannot mix cursors from
// different sort modes. Composite sorts get their own tag so the
// cursor decoder rejects, e.g., a `created_at` cursor presented with
// an `important_first` sort.
export type LibrarySortColumn = "created_at" | "updated_at" | "title" | "important_created" | "tag_sort_key";

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
    case "important_first":
    case "important_last":
      return "important_created";
    case "tag_list_asc":
    case "tag_list_desc":
      return "tag_sort_key";
    default: {
      const exhaustive: never = sort;
      throw new Error(`Unhandled library sort option: ${String(exhaustive)}`);
    }
  }
}
