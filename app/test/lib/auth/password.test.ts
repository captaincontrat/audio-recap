import { describe, expect, test } from "vitest";

import { hashPassword, MIN_PASSWORD_LENGTH, PasswordTooShortError, verifyPassword } from "@/lib/auth/password";

const STRONG_PASSWORD = "correct-horse-battery-staple";

describe("hashPassword", { timeout: 20_000 }, () => {
  test("produces an Argon2id encoded hash", async () => {
    const value = await hashPassword(STRONG_PASSWORD);
    expect(value.startsWith("$argon2id$")).toBe(true);
  });

  test("throws for passwords below the minimum length", async () => {
    const tooShort = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    await expect(hashPassword(tooShort)).rejects.toBeInstanceOf(PasswordTooShortError);
  });
});

describe("verifyPassword", { timeout: 20_000 }, () => {
  test("verifies a password that matches its hash", async () => {
    const hash = await hashPassword(STRONG_PASSWORD);
    expect(await verifyPassword(STRONG_PASSWORD, hash)).toBe(true);
  });

  test("rejects a wrong password", async () => {
    const hash = await hashPassword(STRONG_PASSWORD);
    expect(await verifyPassword("wrong-password-12345", hash)).toBe(false);
  });

  test("returns false when the stored hash is not Argon2id", async () => {
    expect(await verifyPassword(STRONG_PASSWORD, "$scrypt$...")).toBe(false);
  });

  test("returns false when verification throws", async () => {
    expect(await verifyPassword(STRONG_PASSWORD, "$argon2id$not-actually-a-hash")).toBe(false);
  });
});
