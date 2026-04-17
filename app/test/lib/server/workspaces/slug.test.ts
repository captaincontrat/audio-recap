import { describe, expect, test } from "vitest";

import { __internals, generatePersonalWorkspaceSlug, isPersonalWorkspaceSlug } from "@/lib/server/workspaces/slug";

describe("generatePersonalWorkspaceSlug", () => {
  test("produces a slug with the personal prefix and url-safe characters only", () => {
    const slug = generatePersonalWorkspaceSlug();
    expect(slug.startsWith(__internals.PERSONAL_SLUG_PREFIX)).toBe(true);
    expect(slug).toMatch(/^p-[A-Za-z0-9_-]+$/);
  });

  test("does not produce the same slug twice in quick succession", () => {
    const samples = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      samples.add(generatePersonalWorkspaceSlug());
    }
    expect(samples.size).toBe(100);
  });
});

describe("isPersonalWorkspaceSlug", () => {
  test("returns true for the personal prefix", () => {
    expect(isPersonalWorkspaceSlug("p-xyz")).toBe(true);
  });

  test("returns false for team-style slugs", () => {
    expect(isPersonalWorkspaceSlug("acme")).toBe(false);
    expect(isPersonalWorkspaceSlug("team-42")).toBe(false);
  });
});
