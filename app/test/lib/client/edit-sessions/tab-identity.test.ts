import { beforeEach, describe, expect, test } from "vitest";

import { clearStoredTabSessionId, ensureTabSessionId, readStoredTabSessionId } from "@/lib/client/edit-sessions/tab-identity";

// jsdom provides a working `window.sessionStorage`, so we can exercise
// the real storage path without a mock. Every test resets the store so
// identities do not leak across cases.

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("ensureTabSessionId", () => {
  test("generates a tab-prefixed id when none exists and persists it", () => {
    const id = ensureTabSessionId("transcript-one");
    expect(id.startsWith("tab_")).toBe(true);
    expect(id).toMatch(/^tab_[A-Za-z0-9]{16}$/);
    expect(readStoredTabSessionId("transcript-one")).toBe(id);
  });

  test("returns the same id for subsequent calls within the tab", () => {
    const first = ensureTabSessionId("transcript-one");
    const second = ensureTabSessionId("transcript-one");
    expect(first).toBe(second);
  });

  test("namespaces identities per transcript", () => {
    const a = ensureTabSessionId("transcript-a");
    const b = ensureTabSessionId("transcript-b");
    expect(a).not.toBe(b);
    expect(readStoredTabSessionId("transcript-a")).toBe(a);
    expect(readStoredTabSessionId("transcript-b")).toBe(b);
  });

  test("refuses stored values that do not use the expected prefix", () => {
    window.sessionStorage.setItem("transcript-edit-session:tab:transcript-one", "legacy-value");
    const id = ensureTabSessionId("transcript-one");
    expect(id).not.toBe("legacy-value");
    expect(id.startsWith("tab_")).toBe(true);
    expect(window.sessionStorage.getItem("transcript-edit-session:tab:transcript-one")).toBe(id);
  });
});

describe("readStoredTabSessionId", () => {
  test("returns null when no identity was stored", () => {
    expect(readStoredTabSessionId("unknown")).toBeNull();
  });

  test("returns the previously stored identity", () => {
    const id = ensureTabSessionId("transcript-one");
    expect(readStoredTabSessionId("transcript-one")).toBe(id);
  });
});

describe("clearStoredTabSessionId", () => {
  test("removes the stored identity for the given transcript", () => {
    ensureTabSessionId("transcript-one");
    clearStoredTabSessionId("transcript-one");
    expect(readStoredTabSessionId("transcript-one")).toBeNull();
  });

  test("is a no-op when no identity is stored", () => {
    expect(() => clearStoredTabSessionId("missing")).not.toThrow();
    expect(readStoredTabSessionId("missing")).toBeNull();
  });
});
