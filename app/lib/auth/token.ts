import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_TOKEN_BYTES = 32;

export type TokenMaterial = {
  token: string;
  hash: string;
};

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function createTokenMaterial(byteLength = DEFAULT_TOKEN_BYTES): TokenMaterial {
  const bytes = randomBytes(byteLength);
  const token = toBase64Url(bytes);
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensMatch(providedToken: string, storedHash: string): boolean {
  // `Buffer.from(value, "hex")` silently drops invalid hex characters instead
  // of throwing, so a malformed stored hash simply produces a shorter buffer
  // that trips the length check below.
  const expected = Buffer.from(hashToken(providedToken), "hex");
  const actual = Buffer.from(storedHash, "hex");
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}
