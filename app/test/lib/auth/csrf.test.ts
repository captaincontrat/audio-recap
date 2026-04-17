import { describe, expect, test } from "vitest";

import { assertSameOrigin, CsrfOriginMismatchError, fingerprintCsrfToken, generateCsrfToken, isSafeMethod, verifyCsrfToken } from "@/lib/auth/csrf";

describe("isSafeMethod", () => {
  test("treats GET, HEAD and OPTIONS as safe", () => {
    expect(isSafeMethod("GET")).toBe(true);
    expect(isSafeMethod("head")).toBe(true);
    expect(isSafeMethod("options")).toBe(true);
  });

  test("treats mutating methods as unsafe", () => {
    expect(isSafeMethod("POST")).toBe(false);
    expect(isSafeMethod("PUT")).toBe(false);
    expect(isSafeMethod("DELETE")).toBe(false);
    expect(isSafeMethod("PATCH")).toBe(false);
  });
});

describe("assertSameOrigin", () => {
  const expectedOrigin = "https://app.example.com";

  test("skips the check for safe methods", () => {
    expect(() => assertSameOrigin({ method: "GET", origin: null, referer: null, expectedOrigin })).not.toThrow();
  });

  test("accepts requests whose Origin matches the expected origin", () => {
    expect(() => assertSameOrigin({ method: "POST", origin: expectedOrigin, referer: null, expectedOrigin })).not.toThrow();
  });

  test("falls back to the Referer when Origin is missing", () => {
    expect(() => assertSameOrigin({ method: "POST", origin: null, referer: `${expectedOrigin}/sign-in`, expectedOrigin })).not.toThrow();
  });

  test("throws when the Origin header does not match", () => {
    expect(() => assertSameOrigin({ method: "POST", origin: "https://evil.example.com", referer: null, expectedOrigin })).toThrow(CsrfOriginMismatchError);
  });

  test("throws when neither Origin nor Referer is available", () => {
    expect(() => assertSameOrigin({ method: "POST", origin: null, referer: null, expectedOrigin })).toThrow(CsrfOriginMismatchError);
  });

  test("throws when Referer is not a valid URL", () => {
    expect(() => assertSameOrigin({ method: "POST", origin: null, referer: "not-a-url", expectedOrigin })).toThrow(CsrfOriginMismatchError);
  });
});

describe("CSRF token helpers", () => {
  test("generateCsrfToken produces a URL-safe random token", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("fingerprintCsrfToken is stable for the same input", () => {
    expect(fingerprintCsrfToken("token")).toBe(fingerprintCsrfToken("token"));
  });

  test("verifyCsrfToken accepts matching tokens", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, token)).toBe(true);
  });

  test("verifyCsrfToken rejects mismatched tokens", () => {
    expect(verifyCsrfToken(generateCsrfToken(), generateCsrfToken())).toBe(false);
  });
});
