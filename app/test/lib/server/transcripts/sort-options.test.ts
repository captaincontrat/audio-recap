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
});

describe("isAscendingSort", () => {
  test("returns true only for the ascending sort modes", () => {
    expect(isAscendingSort("oldest_first")).toBe(true);
    expect(isAscendingSort("title_asc")).toBe(true);
    expect(isAscendingSort("newest_first")).toBe(false);
    expect(isAscendingSort("recently_updated")).toBe(false);
    expect(isAscendingSort("title_desc")).toBe(false);
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

  test("throws for an unexpected sort mode", () => {
    expect(() => sortColumnFor("surprise" as LibrarySortOption)).toThrowError(/Unhandled library sort option/);
  });
});
