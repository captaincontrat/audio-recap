import { describe, expect, test } from "vitest";

import { buildUpdateValues, sanitizeMarkdownPatch } from "@/lib/server/transcripts/edit-sessions/persistence";

// Covers the pure parts of the autosave persistence module - the
// sanitizer that drops non-lock-protected keys, and the Drizzle
// `set(...)` value builder. The runtime wrapper around `getDb()` is
// covered by Playwright e2e through the autosave route.

const NOW = new Date("2026-01-02T03:04:05.678Z");

describe("sanitizeMarkdownPatch", () => {
  test("returns an empty patch for non-object input", () => {
    expect(sanitizeMarkdownPatch(null)).toEqual({});
    expect(sanitizeMarkdownPatch(undefined)).toEqual({});
    expect(sanitizeMarkdownPatch("string")).toEqual({});
    expect(sanitizeMarkdownPatch(42)).toEqual({});
  });

  test("keeps only the two lock-protected markdown fields", () => {
    const patch = sanitizeMarkdownPatch({
      transcriptMarkdown: "hello",
      recapMarkdown: "world",
      displayTitle: "should not leak",
      tags: ["ignored"],
      important: true,
    });
    expect(patch).toEqual({ transcriptMarkdown: "hello", recapMarkdown: "world" });
  });

  test("drops non-string values for allowed fields", () => {
    expect(sanitizeMarkdownPatch({ transcriptMarkdown: 123 })).toEqual({});
    expect(sanitizeMarkdownPatch({ recapMarkdown: null })).toEqual({});
    expect(sanitizeMarkdownPatch({ recapMarkdown: undefined, transcriptMarkdown: "ok" })).toEqual({ transcriptMarkdown: "ok" });
  });
});

describe("buildUpdateValues", () => {
  test("returns null when the patch touches none of the locked fields", () => {
    expect(buildUpdateValues({}, NOW)).toBeNull();
  });

  test("returns a set-payload with the updatedAt stamp when at least one field changes", () => {
    const values = buildUpdateValues({ transcriptMarkdown: "hello" }, NOW);
    expect(values).toEqual({ transcriptMarkdown: "hello", updatedAt: NOW });
  });

  test("carries both fields when both are present", () => {
    const values = buildUpdateValues({ transcriptMarkdown: "hi", recapMarkdown: "bye" }, NOW);
    expect(values).toEqual({ transcriptMarkdown: "hi", recapMarkdown: "bye", updatedAt: NOW });
  });

  test("ignores unknown keys that somehow slip through the patch type", () => {
    const payload = { transcriptMarkdown: "hi", importantToggle: true } as unknown as Parameters<typeof buildUpdateValues>[0];
    const values = buildUpdateValues(payload, NOW);
    expect(values).toEqual({ transcriptMarkdown: "hi", updatedAt: NOW });
  });
});
