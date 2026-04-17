import { describe, expect, test } from "vitest";

import { isValidEmail, normalizeEmail, normalizeEmailOrThrow } from "@/lib/auth/normalize";

describe("normalizeEmail", () => {
  test("trims whitespace and lowercases the address", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  test("leaves already-normalized addresses untouched", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });
});

describe("isValidEmail", () => {
  test("accepts well-formed addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  test("rejects missing local part", () => {
    expect(isValidEmail("@example.com")).toBe(false);
  });

  test("rejects missing domain", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  test("rejects strings without an @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  test("rejects strings with whitespace", () => {
    expect(isValidEmail("user name@example.com")).toBe(false);
  });
});

describe("normalizeEmailOrThrow", () => {
  test("returns the normalized email on success", () => {
    expect(normalizeEmailOrThrow("User@Example.com")).toBe("user@example.com");
  });

  test("throws on an invalid email", () => {
    expect(() => normalizeEmailOrThrow("not-an-email")).toThrow(/Invalid email address/);
  });
});
