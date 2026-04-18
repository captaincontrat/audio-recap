import { describe, expect, test } from "vitest";

import { describeLastLoginMethod } from "@/lib/auth/last-login-method";

describe("describeLastLoginMethod", () => {
  test("maps each known method to a friendly label", () => {
    expect(describeLastLoginMethod("email")).toBe("your email and password");
    expect(describeLastLoginMethod("magic-link")).toBe("a magic link");
    expect(describeLastLoginMethod("passkey")).toBe("a passkey");
    expect(describeLastLoginMethod("google")).toBe("Google");
  });

  test("returns null for unknown methods so the UI falls back silently", () => {
    expect(describeLastLoginMethod("facebook")).toBeNull();
    expect(describeLastLoginMethod("siwe")).toBeNull();
    expect(describeLastLoginMethod("unexpected-value")).toBeNull();
  });

  test("returns null when no hint exists (first sign-in, cleared cookie)", () => {
    expect(describeLastLoginMethod(null)).toBeNull();
    expect(describeLastLoginMethod(undefined)).toBeNull();
    expect(describeLastLoginMethod("")).toBeNull();
  });
});
