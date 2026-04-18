import { describe, expect, test } from "vitest";

import {
  assertGoogleProfileVerified,
  assertOAuthCreationVerified,
  GoogleEmailUnverifiedError,
  isOAuthCreationPath,
  OAuthEmailUnverifiedError,
} from "@/lib/auth/oauth-linking";

describe("isOAuthCreationPath", () => {
  test("matches Google OAuth callback paths", () => {
    expect(isOAuthCreationPath("/callback/google")).toBe(true);
    expect(isOAuthCreationPath("/oauth2/callback/google")).toBe(true);
  });

  test("matches the Google One Tap callback path", () => {
    expect(isOAuthCreationPath("/one-tap/callback")).toBe(true);
  });

  test("does not match password sign-up or other Better Auth paths", () => {
    expect(isOAuthCreationPath("/sign-up/email")).toBe(false);
    expect(isOAuthCreationPath("/sign-in/email")).toBe(false);
    expect(isOAuthCreationPath("/magic-link/verify")).toBe(false);
    expect(isOAuthCreationPath("/passkey/verify-authentication")).toBe(false);
  });

  test("handles missing or empty path values without throwing", () => {
    expect(isOAuthCreationPath(undefined)).toBe(false);
    expect(isOAuthCreationPath(null)).toBe(false);
    expect(isOAuthCreationPath("")).toBe(false);
  });
});

describe("assertGoogleProfileVerified", () => {
  test("accepts a profile with email_verified: true", () => {
    expect(() => assertGoogleProfileVerified({ email_verified: true })).not.toThrow();
  });

  test("rejects a profile with email_verified: false", () => {
    expect(() => assertGoogleProfileVerified({ email_verified: false })).toThrow(GoogleEmailUnverifiedError);
  });

  test("rejects a profile where email_verified is missing", () => {
    expect(() => assertGoogleProfileVerified({})).toThrow(GoogleEmailUnverifiedError);
  });

  test("rejects a profile where email_verified is explicitly null", () => {
    expect(() => assertGoogleProfileVerified({ email_verified: null })).toThrow(GoogleEmailUnverifiedError);
  });

  test("the thrown error carries the contract error code", () => {
    try {
      assertGoogleProfileVerified({});
      expect.unreachable("expected GoogleEmailUnverifiedError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleEmailUnverifiedError);
      expect((error as Error).message).toBe("google_email_unverified");
    }
  });
});

describe("assertOAuthCreationVerified", () => {
  test("allows password sign-up to proceed even when emailVerified is false", () => {
    expect(() => assertOAuthCreationVerified({ emailVerified: false }, "/sign-up/email")).not.toThrow();
  });

  test("rejects Google callback user creation when emailVerified is false", () => {
    expect(() => assertOAuthCreationVerified({ emailVerified: false }, "/callback/google")).toThrow(OAuthEmailUnverifiedError);
  });

  test("rejects Google One Tap user creation when emailVerified is missing", () => {
    expect(() => assertOAuthCreationVerified({}, "/one-tap/callback")).toThrow(OAuthEmailUnverifiedError);
  });

  test("allows Google callback user creation when emailVerified is true", () => {
    expect(() => assertOAuthCreationVerified({ emailVerified: true }, "/callback/google")).not.toThrow();
  });

  test("tolerates a missing path (e.g. direct database-hook invocation)", () => {
    expect(() => assertOAuthCreationVerified({ emailVerified: false }, undefined)).not.toThrow();
    expect(() => assertOAuthCreationVerified({ emailVerified: false }, null)).not.toThrow();
  });

  test("the thrown error carries the contract error code", () => {
    try {
      assertOAuthCreationVerified({ emailVerified: false }, "/callback/google");
      expect.unreachable("expected OAuthEmailUnverifiedError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(OAuthEmailUnverifiedError);
      expect((error as Error).message).toBe("oauth_email_unverified");
    }
  });
});
