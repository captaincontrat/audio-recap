import { describe, expect, test } from "vitest";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
  forgotPasswordInputSchema,
  resendVerificationInputSchema,
  resetPasswordInputSchema,
  signInInputSchema,
  signUpInputSchema,
  verifyEmailInputSchema,
} from "@/lib/auth/schemas";

const STRONG_PASSWORD = "correct-horse-battery-staple";

describe("signUpInputSchema", () => {
  test("accepts valid input and trims incidental whitespace", () => {
    const result = signUpInputSchema.parse({
      email: "  User@Example.com  ",
      password: STRONG_PASSWORD,
      name: "  Ada Lovelace  ",
    });

    expect(result.email).toBe("User@Example.com");
    expect(result.password).toBe(STRONG_PASSWORD);
    expect(result.name).toBe("Ada Lovelace");
  });

  test("rejects invalid emails and short passwords with useful messages", () => {
    const result = signUpInputSchema.safeParse({ email: "not-an-email", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Enter a valid email address");
      expect(messages).toContain(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
  });

  test("rejects empty email with the required message", () => {
    const result = signUpInputSchema.safeParse({ email: "   ", password: STRONG_PASSWORD });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Email is required");
    }
  });

  test("allows the name field to be omitted", () => {
    const result = signUpInputSchema.parse({ email: "ada@example.com", password: STRONG_PASSWORD });
    expect(result.name).toBeUndefined();
  });
});

describe("signInInputSchema", () => {
  test("requires a password but does not enforce the minimum length", () => {
    const result = signInInputSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Password is required");
    }
  });

  test("accepts any non-empty password", () => {
    const result = signInInputSchema.safeParse({ email: "user@example.com", password: "shortpwd" });
    expect(result.success).toBe(true);
  });
});

describe("forgotPasswordInputSchema", () => {
  test("requires a valid email address", () => {
    expect(forgotPasswordInputSchema.safeParse({ email: "bad" }).success).toBe(false);
    expect(forgotPasswordInputSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });
});

describe("resetPasswordInputSchema", () => {
  test("requires both a token and a password that satisfies the min length", () => {
    const bad = resetPasswordInputSchema.safeParse({ token: "", password: STRONG_PASSWORD });
    expect(bad.success).toBe(false);
    const alsoBad = resetPasswordInputSchema.safeParse({ token: "abc", password: "short" });
    expect(alsoBad.success).toBe(false);
    const ok = resetPasswordInputSchema.safeParse({ token: "abc", password: STRONG_PASSWORD });
    expect(ok.success).toBe(true);
  });
});

describe("verifyEmailInputSchema", () => {
  test("requires a token", () => {
    expect(verifyEmailInputSchema.safeParse({ token: "" }).success).toBe(false);
    expect(verifyEmailInputSchema.safeParse({ token: "abc" }).success).toBe(true);
  });
});

describe("resendVerificationInputSchema", () => {
  test("accepts empty input", () => {
    expect(resendVerificationInputSchema.safeParse({}).success).toBe(true);
  });

  test("validates the email when provided", () => {
    expect(resendVerificationInputSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
    expect(resendVerificationInputSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});
