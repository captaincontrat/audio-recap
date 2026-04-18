import { describe, expect, test } from "vitest";

import { encodeCursor } from "@/lib/server/transcripts/cursor";
import {
  escapeSearchForIlike,
  LIBRARY_DEFAULT_PAGE_SIZE,
  LIBRARY_MAX_PAGE_SIZE,
  LIBRARY_MAX_SEARCH_LENGTH,
  LIBRARY_MAX_TAG_FILTER_COUNT,
  LIBRARY_STATUS_FILTER_OPTIONS,
  LibraryQueryParseError,
  parseLibraryQueryOptions,
} from "@/lib/server/transcripts/query-options";

describe("parseLibraryQueryOptions", () => {
  test("applies defaults when every input is empty or missing", () => {
    expect(parseLibraryQueryOptions({})).toEqual({
      search: null,
      sort: "newest_first",
      status: null,
      cursor: null,
      limit: LIBRARY_DEFAULT_PAGE_SIZE,
      important: null,
      tags: [],
    });

    expect(parseLibraryQueryOptions({ search: null, sort: null, status: null, cursor: null, limit: null, important: null, tags: null })).toEqual({
      search: null,
      sort: "newest_first",
      status: null,
      cursor: null,
      limit: LIBRARY_DEFAULT_PAGE_SIZE,
      important: null,
      tags: [],
    });

    expect(parseLibraryQueryOptions({ search: "", sort: "", status: "", cursor: "", limit: "", important: "", tags: [] })).toEqual({
      search: null,
      sort: "newest_first",
      status: null,
      cursor: null,
      limit: LIBRARY_DEFAULT_PAGE_SIZE,
      important: null,
      tags: [],
    });
  });

  test("accepts every known sort option", () => {
    const sorts = [
      "newest_first",
      "oldest_first",
      "recently_updated",
      "title_asc",
      "title_desc",
      "important_first",
      "important_last",
      "tag_list_asc",
      "tag_list_desc",
    ] as const;
    for (const sort of sorts) {
      expect(parseLibraryQueryOptions({ sort }).sort).toBe(sort);
    }
  });

  test("accepts every known status filter", () => {
    for (const status of LIBRARY_STATUS_FILTER_OPTIONS) {
      expect(parseLibraryQueryOptions({ status }).status).toBe(status);
    }
  });

  test("normalizes search: trims whitespace, collapses empty to null", () => {
    expect(parseLibraryQueryOptions({ search: "   " }).search).toBeNull();
    expect(parseLibraryQueryOptions({ search: "   team sync  " }).search).toBe("team sync");
  });

  test("truncates over-long search queries to the max length", () => {
    const longInput = "a".repeat(LIBRARY_MAX_SEARCH_LENGTH + 50);
    expect(parseLibraryQueryOptions({ search: longInput }).search).toHaveLength(LIBRARY_MAX_SEARCH_LENGTH);
  });

  test("parses a valid cursor when the sort column matches", () => {
    const token = encodeCursor({ column: "created_at", value: "2026-01-01T00:00:00.000Z", id: "id_1" });
    const options = parseLibraryQueryOptions({ sort: "newest_first", cursor: token });
    expect(options.cursor).toEqual({ column: "created_at", value: "2026-01-01T00:00:00.000Z", id: "id_1" });
  });

  test("accepts limit as a numeric string or number", () => {
    expect(parseLibraryQueryOptions({ limit: "15" }).limit).toBe(15);
    expect(parseLibraryQueryOptions({ limit: 25 }).limit).toBe(25);
    expect(parseLibraryQueryOptions({ limit: LIBRARY_MAX_PAGE_SIZE }).limit).toBe(LIBRARY_MAX_PAGE_SIZE);
  });

  test("throws invalid_sort when a non-default unknown sort is supplied", () => {
    expect(() => parseLibraryQueryOptions({ sort: "alphabetical" })).toThrowError(LibraryQueryParseError);
    expect(() => parseLibraryQueryOptions({ sort: "alphabetical" })).toThrowError(/Unknown library sort option/);

    try {
      parseLibraryQueryOptions({ sort: "alphabetical" });
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryQueryParseError);
      expect((error as LibraryQueryParseError).reason).toBe("invalid_sort");
      expect((error as LibraryQueryParseError).code).toBe("library_query_invalid");
    }
  });

  test("throws invalid_status for an unknown status filter", () => {
    try {
      parseLibraryQueryOptions({ status: "not_a_status" });
      throw new Error("expected parseLibraryQueryOptions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryQueryParseError);
      expect((error as LibraryQueryParseError).reason).toBe("invalid_status");
    }
  });

  test("throws invalid_cursor when cursor column does not match the active sort", () => {
    const titleToken = encodeCursor({ column: "title", value: "x", id: "id_1" });
    try {
      parseLibraryQueryOptions({ sort: "newest_first", cursor: titleToken });
      throw new Error("expected parseLibraryQueryOptions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryQueryParseError);
      expect((error as LibraryQueryParseError).reason).toBe("invalid_cursor");
    }
  });

  test("throws invalid_cursor when cursor is malformed base64", () => {
    try {
      parseLibraryQueryOptions({ sort: "newest_first", cursor: "not_a_valid_cursor" });
      throw new Error("expected parseLibraryQueryOptions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryQueryParseError);
      expect((error as LibraryQueryParseError).reason).toBe("invalid_cursor");
    }
  });

  test.each([
    ["negative", -1],
    ["zero", 0],
    ["fractional", 5.5],
    ["non-numeric string", "abc"],
    ["over-max integer", LIBRARY_MAX_PAGE_SIZE + 1],
    ["infinity string", "Infinity"],
    ["NaN", Number.NaN],
  ])("throws invalid_limit for %s", (_label, value) => {
    try {
      parseLibraryQueryOptions({ limit: value as number | string });
      throw new Error("expected parseLibraryQueryOptions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryQueryParseError);
      expect((error as LibraryQueryParseError).reason).toBe("invalid_limit");
    }
  });

  test("LibraryQueryParseError throws exhaustively on an unexpected reason", () => {
    expect(() => new LibraryQueryParseError("unexpected" as never)).toThrowError(/Unhandled library query parse failure/);
  });

  test("LibraryQueryParseError accepts a custom message override", () => {
    const error = new LibraryQueryParseError("invalid_limit", "too big");
    expect(error.message).toBe("too big");
    expect(error.name).toBe("LibraryQueryParseError");
    expect(error.code).toBe("library_query_invalid");
  });

  test("parses the important filter as a boolean or null", () => {
    expect(parseLibraryQueryOptions({ important: "true" }).important).toBe(true);
    expect(parseLibraryQueryOptions({ important: "false" }).important).toBe(false);
    expect(parseLibraryQueryOptions({ important: null }).important).toBeNull();
    expect(parseLibraryQueryOptions({ important: "" }).important).toBeNull();
    expect(parseLibraryQueryOptions({}).important).toBeNull();
  });

  test("throws invalid_important for unknown important values", () => {
    try {
      parseLibraryQueryOptions({ important: "yes" });
      throw new Error("expected parseLibraryQueryOptions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryQueryParseError);
      expect((error as LibraryQueryParseError).reason).toBe("invalid_important");
    }
  });

  test("normalizes tag filters: trim, lowercase, deduplicate", () => {
    expect(parseLibraryQueryOptions({ tags: "Kickoff" }).tags).toEqual(["kickoff"]);
    expect(parseLibraryQueryOptions({ tags: ["Kickoff", "kickoff ", "  PLANNING"] }).tags).toEqual(["kickoff", "planning"]);
    expect(parseLibraryQueryOptions({ tags: [] }).tags).toEqual([]);
  });

  test("rejects tag filter with empty entries, over-long tags, or non-string values", () => {
    const assertInvalid = (raw: { tags: unknown }) => {
      try {
        parseLibraryQueryOptions(raw as never);
        throw new Error("expected parseLibraryQueryOptions to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(LibraryQueryParseError);
        expect((error as LibraryQueryParseError).reason).toBe("invalid_tags");
      }
    };

    assertInvalid({ tags: [""] });
    assertInvalid({ tags: ["   "] });
    assertInvalid({ tags: [123] });
    assertInvalid({ tags: ["x".repeat(33)] });
  });

  test("rejects tag filter lists exceeding the filter cap", () => {
    const many = Array.from({ length: LIBRARY_MAX_TAG_FILTER_COUNT + 1 }, (_, i) => `tag-${i}`);
    try {
      parseLibraryQueryOptions({ tags: many });
      throw new Error("expected parseLibraryQueryOptions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryQueryParseError);
      expect((error as LibraryQueryParseError).reason).toBe("invalid_tags");
    }
  });
});

describe("escapeSearchForIlike", () => {
  test("escapes SQL wildcard characters so they behave as literals", () => {
    expect(escapeSearchForIlike("50%")).toBe("50\\%");
    expect(escapeSearchForIlike("my_file")).toBe("my\\_file");
    expect(escapeSearchForIlike("a\\b")).toBe("a\\\\b");
  });

  test("leaves plain text unchanged", () => {
    expect(escapeSearchForIlike("team sync")).toBe("team sync");
    expect(escapeSearchForIlike("")).toBe("");
  });

  test("escapes backslash before % and _ so the escape character itself is literal", () => {
    expect(escapeSearchForIlike("\\%")).toBe("\\\\\\%");
  });
});
