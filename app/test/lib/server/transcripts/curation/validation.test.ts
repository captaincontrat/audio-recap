import { describe, expect, test } from "vitest";

import {
  buildTagSortKey,
  CurationValidationError,
  MAX_CUSTOM_TITLE_LENGTH,
  MAX_TAG_COUNT,
  MAX_TAG_LENGTH,
  normalizeTag,
  TAG_SORT_KEY_SEPARATOR,
  validateCurationPatch,
  validateCustomTitle,
  validateIsImportant,
  validateTags,
} from "@/lib/server/transcripts/curation/validation";

describe("validateCustomTitle", () => {
  test("accepts a non-empty string within the length limit", () => {
    expect(validateCustomTitle("Kickoff with Acme")).toBe("Kickoff with Acme");
  });

  test("trims surrounding whitespace", () => {
    expect(validateCustomTitle("   Kickoff   ")).toBe("Kickoff");
  });

  test("treats explicit null as a cleared override", () => {
    expect(validateCustomTitle(null)).toBeNull();
  });

  test("treats an all-whitespace string as a cleared override", () => {
    expect(validateCustomTitle("   ")).toBeNull();
  });

  test("treats an empty string as a cleared override", () => {
    expect(validateCustomTitle("")).toBeNull();
  });

  test("rejects non-string, non-null values", () => {
    expect(() => validateCustomTitle(42 as unknown)).toThrow(CurationValidationError);
    expect(() => validateCustomTitle({} as unknown)).toThrow(CurationValidationError);
    expect(() => validateCustomTitle(undefined as unknown)).toThrow(CurationValidationError);
  });

  test("rejects titles longer than the max length", () => {
    const overLong = "a".repeat(MAX_CUSTOM_TITLE_LENGTH + 1);
    const err = captureThrown(() => validateCustomTitle(overLong));
    expect(err).toBeInstanceOf(CurationValidationError);
    expect(err.reason).toBe("custom_title_too_long");
  });

  test("accepts exactly the max length after trimming", () => {
    const atMax = "x".repeat(MAX_CUSTOM_TITLE_LENGTH);
    expect(validateCustomTitle(atMax)).toBe(atMax);
  });
});

describe("normalizeTag", () => {
  test("lowercases and trims", () => {
    expect(normalizeTag("  Research  ")).toBe("research");
  });

  test("rejects empty-after-normalization values", () => {
    const err = captureThrown(() => normalizeTag("   "));
    expect(err.reason).toBe("tag_empty_after_normalization");
  });

  test("rejects non-string values", () => {
    const err = captureThrown(() => normalizeTag(7 as unknown));
    expect(err.reason).toBe("tag_invalid_type");
  });

  test("rejects over-long tags", () => {
    const overLong = "z".repeat(MAX_TAG_LENGTH + 1);
    const err = captureThrown(() => normalizeTag(overLong));
    expect(err.reason).toBe("tag_too_long");
  });
});

describe("validateTags", () => {
  test("returns normalized deduplicated tags preserving first-appearance order", () => {
    const result = validateTags(["Research", "research", "Design", "DESIGN", "alpha"]);
    expect(result).toEqual(["research", "design", "alpha"]);
  });

  test("returns an empty list for []", () => {
    expect(validateTags([])).toEqual([]);
  });

  test("rejects non-array values", () => {
    const err = captureThrown(() => validateTags("research" as unknown));
    expect(err.reason).toBe("tags_invalid_type");
  });

  test("rejects when the raw list exceeds the count limit even if duplicates would collapse", () => {
    const duplicates = Array.from({ length: MAX_TAG_COUNT + 1 }, () => "dup");
    const err = captureThrown(() => validateTags(duplicates));
    expect(err.reason).toBe("tags_too_many");
  });

  test("accepts exactly the count limit", () => {
    const atLimit = Array.from({ length: MAX_TAG_COUNT }, (_, index) => `tag-${index}`);
    const result = validateTags(atLimit);
    expect(result).toHaveLength(MAX_TAG_COUNT);
  });

  test("surfaces per-tag errors from normalizeTag", () => {
    const err = captureThrown(() => validateTags(["valid", ""]));
    expect(err.reason).toBe("tag_empty_after_normalization");
  });
});

describe("validateIsImportant", () => {
  test("accepts true and false", () => {
    expect(validateIsImportant(true)).toBe(true);
    expect(validateIsImportant(false)).toBe(false);
  });

  test("rejects any other shape", () => {
    expect(() => validateIsImportant("true" as unknown)).toThrow(CurationValidationError);
    expect(() => validateIsImportant(1 as unknown)).toThrow(CurationValidationError);
    expect(() => validateIsImportant(null as unknown)).toThrow(CurationValidationError);
  });
});

describe("buildTagSortKey", () => {
  test("returns null for an empty tag list so untagged records use default NULLS semantics", () => {
    expect(buildTagSortKey([])).toBeNull();
  });

  test("joins sorted tags with the stable separator", () => {
    const key = buildTagSortKey(["design", "alpha", "research"]);
    expect(key).toBe(["alpha", "design", "research"].join(TAG_SORT_KEY_SEPARATOR));
  });

  test("sort is deterministic regardless of input order", () => {
    const a = buildTagSortKey(["alpha", "beta", "gamma"]);
    const b = buildTagSortKey(["gamma", "alpha", "beta"]);
    expect(a).toBe(b);
  });
});

describe("validateCurationPatch", () => {
  test("passes through customTitle and normalized tags and builds a sort key", () => {
    const result = validateCurationPatch({ customTitle: "Kickoff", tags: ["Research", "research"] });
    expect(result.customTitle).toBe("Kickoff");
    expect(result.tags).toEqual(["research"]);
    expect(result.tagSortKey).toBe("research");
  });

  test("builds a null sort key when tags collapse to an empty list", () => {
    const result = validateCurationPatch({ tags: [] });
    expect(result.tags).toEqual([]);
    expect(result.tagSortKey).toBeNull();
  });

  test("keeps absent fields absent in the output", () => {
    const result = validateCurationPatch({ customTitle: "Kickoff" });
    expect(result.customTitle).toBe("Kickoff");
    expect(Object.hasOwn(result, "tags")).toBe(false);
    expect(Object.hasOwn(result, "tagSortKey")).toBe(false);
    expect(Object.hasOwn(result, "isImportant")).toBe(false);
  });

  test("allows clearing a customTitle with explicit null", () => {
    const result = validateCurationPatch({ customTitle: null });
    expect(Object.hasOwn(result, "customTitle")).toBe(true);
    expect(result.customTitle).toBeNull();
  });

  test("refuses an empty patch", () => {
    const err = captureThrown(() => validateCurationPatch({}));
    expect(err.reason).toBe("empty_patch");
  });

  test("is resilient to undefined-valued keys (treated as absent)", () => {
    const result = validateCurationPatch({ customTitle: "Kickoff", tags: undefined, isImportant: undefined });
    expect(result.customTitle).toBe("Kickoff");
    expect(Object.hasOwn(result, "tags")).toBe(false);
    expect(Object.hasOwn(result, "isImportant")).toBe(false);
  });

  test("accepts isImportant on its own", () => {
    const result = validateCurationPatch({ isImportant: true });
    expect(result.isImportant).toBe(true);
  });
});

function captureThrown(action: () => unknown): CurationValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof CurationValidationError) return error;
    throw error;
  }
  throw new Error("Expected action to throw a CurationValidationError");
}
