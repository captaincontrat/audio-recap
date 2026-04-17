import { describe, expect, test, vi } from "vitest";

// Dedicated test file that mocks `@node-rs/argon2` so we can exercise the
// `catch` branch inside `verifyPassword` without poisoning other password
// tests with a faulty `verify` implementation. `vi.mock` is hoisted above
// imports, which is why the helper module import is dynamic.
vi.mock("@node-rs/argon2", async () => {
  const actual = await vi.importActual<typeof import("@node-rs/argon2")>("@node-rs/argon2");
  return {
    ...actual,
    verify: vi.fn().mockRejectedValue(new Error("argon2 native error")),
  };
});

describe("verifyPassword (catch branch)", () => {
  test("returns false when the underlying verify rejects", async () => {
    const mod = await import("@/lib/auth/password");
    const result = await mod.verifyPassword("correct-horse-battery-staple", "$argon2id$malformed");
    expect(result).toBe(false);
  });
});
