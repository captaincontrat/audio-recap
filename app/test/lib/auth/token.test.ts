import { describe, expect, test } from "vitest";

import { createTokenMaterial, hashToken, tokensMatch } from "@/lib/auth/token";

describe("token helpers", () => {
  test("createTokenMaterial yields a url-safe token and its matching hash", () => {
    const material = createTokenMaterial();

    expect(material.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(material.hash).toHaveLength(64);
    expect(hashToken(material.token)).toBe(material.hash);
  });

  test("createTokenMaterial respects a custom byte length", () => {
    const material = createTokenMaterial(16);
    const decoded = Buffer.from(material.token, "base64url");

    expect(decoded.length).toBe(16);
  });

  test("tokensMatch is true only when the token reproduces the stored hash", () => {
    const { token, hash } = createTokenMaterial();

    expect(tokensMatch(token, hash)).toBe(true);
    expect(tokensMatch("wrong-token", hash)).toBe(false);
  });

  test("tokensMatch rejects stored values whose decoded length differs", () => {
    const { token } = createTokenMaterial();

    expect(tokensMatch(token, "deadbeef")).toBe(false);
  });

  test("tokensMatch rejects non-hex stored values", () => {
    const { token } = createTokenMaterial();

    expect(tokensMatch(token, "\u007Fnot-hex")).toBe(false);
  });
});
