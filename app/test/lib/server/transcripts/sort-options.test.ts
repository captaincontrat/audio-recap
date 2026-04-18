import { describe, expect, test } from "vitest";

import {
  DEFAULT_LIBRARY_SORT,
  isAscendingSort,
  isTitleSort,
  LIBRARY_SORT_OPTIONS,
  type LibrarySortOption,
  parseLibrarySort,
  sortColumnFor,
} from "@/lib/server/transcripts/sort-options";

describe("parseLibrarySort", () => {
  test("returns the default sort for null or empty input", () => {
    expect(parseLibrarySort(null)).toBe(DEFAULT_LIBRARY_SORT);
    expect(parseLibrarySort(undefined)).toBe(DEFAULT_LIBRARY_SORT);
    expect(parseLibrarySort("")).toBe(DEFAULT_LIBRARY_SORT);
  });

  test("returns the matching sort when a known value is provided", () => {
    for (const option of LIBRARY_SORT_OPTIONS) {
      expect(parseLibrarySort(option)).toBe(option);
    }
  });

  test("returns null for an unknown sort value", () => {
    expect(parseLibrarySort("newest")).toBeNull();
    expect(parseLibrarySort("chronological")).toBeNull();
  });
});

describe("isTitleSort", () => {
  test("flags the two title-based sort modes", () => {
    expect(isTitleSort("title_asc")).toBe(true);
    expect(isTitleSort("title_desc")).toBe(true);
  });

  test("leaves the time-based sort modes as non-title", () => {
    expect(isTitleSort("newest_first")).toBe(false);
    expect(isTitleSort("oldest_first")).toBe(false);
    expect(isTitleSort("recently_updated")).toBe(false);
  });

  test("leaves the curation sort modes as non-title", () => {
    expect(isTitleSort("important_first")).toBe(false);
    expect(isTitleSort("important_last")).toBe(false);
    expect(isTitleSort("tag_list_asc")).toBe(false);
    expect(isTitleSort("tag_list_desc")).toBe(false);
  });

  test("leaves the shared sort modes as non-title", () => {
    expect(isTitleSort("shared_first")).toBe(false);
    expect(isTitleSort("unshared_first")).toBe(false);
  });
});

describe("isAscendingSort", () => {
  test("returns true only for the ascending sort modes", () => {
    expect(isAscendingSort("oldest_first")).toBe(true);
    expect(isAscendingSort("title_asc")).toBe(true);
    expect(isAscendingSort("newest_first")).toBe(false);
    expect(isAscendingSort("recently_updated")).toBe(false);
    expect(isAscendingSort("title_desc")).toBe(false);
  });

  test("classifies curation sort modes by direction", () => {
    // `important_first` puts important rows first via DESC on the
    // important flag; `important_last` uses ASC so plain rows lead.
    expect(isAscendingSort("important_first")).toBe(false);
    expect(isAscendingSort("important_last")).toBe(true);
    // Tag sorts use ASC/DESC directly on the derived sort key.
    expect(isAscendingSort("tag_list_asc")).toBe(true);
    expect(isAscendingSort("tag_list_desc")).toBe(false);
  });

  test("classifies shared sort modes by direction", () => {
    // `shared_first` puts publicly-shared rows first via DESC on
    // the share flag; `unshared_first` uses ASC so non-shared rows
    // lead. Mirrors the important-sort direction convention so the
    // composite cursor layout can be reused.
    expect(isAscendingSort("shared_first")).toBe(false);
    expect(isAscendingSort("unshared_first")).toBe(true);
  });

  test("throws for an unexpected sort mode", () => {
    expect(() => isAscendingSort("surprise" as LibrarySortOption)).toThrowError(/Unhandled library sort option/);
  });
});

describe("sortColumnFor", () => {
  test("maps each sort mode to a stable column identifier", () => {
    expect(sortColumnFor("newest_first")).toBe("created_at");
    expect(sortColumnFor("oldest_first")).toBe("created_at");
    expect(sortColumnFor("recently_updated")).toBe("updated_at");
    expect(sortColumnFor("title_asc")).toBe("title");
    expect(sortColumnFor("title_desc")).toBe("title");
  });

  test("maps the curation sort modes to their composite cursor columns", () => {
    // important_first/last share the composite `important_created`
    // column so a cursor from one cannot be reused under the other.
    expect(sortColumnFor("important_first")).toBe("important_created");
    expect(sortColumnFor("important_last")).toBe("important_created");
    // tag_list_asc/desc share `tag_sort_key` for the same reason.
    expect(sortColumnFor("tag_list_asc")).toBe("tag_sort_key");
    expect(sortColumnFor("tag_list_desc")).toBe("tag_sort_key");
  });

  test("maps the shared sort modes to the composite shared_created column", () => {
    // shared_first/unshared_first share the composite
    // `shared_created` column for the same reason as the important
    // variants: the cursor values are interchangeable only within
    // the same direction family, so both modes intentionally map
    // to the same column and let the comparator in the query
    // module flip direction.
    expect(sortColumnFor("shared_first")).toBe("shared_created");
    expect(sortColumnFor("unshared_first")).toBe("shared_created");
  });

  test("throws for an unexpected sort mode", () => {
    expect(() => sortColumnFor("surprise" as LibrarySortOption)).toThrowError(/Unhandled library sort option/);
  });
});
