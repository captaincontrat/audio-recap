import { describe, expect, test } from "vitest";

import { generateLockToken, generateTabSessionId } from "@/lib/server/transcripts/edit-sessions/ids";

describe("generateTabSessionId", () => {
  test("produces a `tab_`-prefixed alphanumeric id of the expected length", () => {
    const id = generateTabSessionId();
    expect(id.startsWith("tab_")).toBe(true);
    expect(id.length).toBe("tab_".length + 20);
    expect(id).toMatch(/^tab_[A-Za-z0-9]{20}$/);
  });

  test("produces a different value every call", () => {
    const ids = new Set(Array.from({ length: 8 }, generateTabSessionId));
    expect(ids.size).toBe(8);
  });
});

describe("generateLockToken", () => {
  test("produces a `lock_`-prefixed alphanumeric token of the expected length", () => {
    const id = generateLockToken();
    expect(id.startsWith("lock_")).toBe(true);
    expect(id.length).toBe("lock_".length + 28);
    expect(id).toMatch(/^lock_[A-Za-z0-9]{28}$/);
  });

  test("does not collide across calls", () => {
    const ids = new Set(Array.from({ length: 8 }, generateLockToken));
    expect(ids.size).toBe(8);
  });
});
