import { describe, expect, test } from "vitest";

import { buildCurationUpdateSet } from "@/lib/server/transcripts/curation/queries";
import { TAG_SORT_KEY_SEPARATOR } from "@/lib/server/transcripts/curation/validation";

describe("buildCurationUpdateSet", () => {
  const now = new Date("2024-05-12T10:00:00.000Z");

  test("always bumps updatedAt", () => {
    const set = buildCurationUpdateSet({ isImportant: true }, now);
    expect(set.updatedAt).toBe(now);
  });

  test("includes customTitle only when the field is present in the values object", () => {
    const withTitle = buildCurationUpdateSet({ customTitle: "Weekly sync" }, now);
    expect(withTitle).toHaveProperty("customTitle", "Weekly sync");

    const withoutTitle = buildCurationUpdateSet({ isImportant: true }, now);
    expect(Object.hasOwn(withoutTitle, "customTitle")).toBe(false);
  });

  test("preserves an explicit customTitle = null so the override can be cleared", () => {
    const set = buildCurationUpdateSet({ customTitle: null }, now);
    expect(Object.hasOwn(set, "customTitle")).toBe(true);
    expect(set.customTitle).toBeNull();
  });

  test("writes tags and derived tagSortKey together", () => {
    const set = buildCurationUpdateSet({ tags: ["alpha", "beta"], tagSortKey: ["alpha", "beta"].join(TAG_SORT_KEY_SEPARATOR) }, now);
    expect(set.tags).toEqual(["alpha", "beta"]);
    expect(set.tagSortKey).toBe(["alpha", "beta"].join(TAG_SORT_KEY_SEPARATOR));
  });

  test("writes an empty tag list alongside a null sort key", () => {
    const set = buildCurationUpdateSet({ tags: [], tagSortKey: null }, now);
    expect(set.tags).toEqual([]);
    expect(set.tagSortKey).toBeNull();
  });

  test("does not write tags or tagSortKey when the field is absent", () => {
    const set = buildCurationUpdateSet({ customTitle: "Kickoff" }, now);
    expect(Object.hasOwn(set, "tags")).toBe(false);
    expect(Object.hasOwn(set, "tagSortKey")).toBe(false);
  });

  test("writes isImportant only when the field is present", () => {
    const set = buildCurationUpdateSet({ isImportant: false }, now);
    expect(set.isImportant).toBe(false);

    const otherSet = buildCurationUpdateSet({ customTitle: "X" }, now);
    expect(Object.hasOwn(otherSet, "isImportant")).toBe(false);
  });
});
