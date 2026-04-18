import "server-only";

import { hash, verify } from "@node-rs/argon2";

import { MIN_PASSWORD_LENGTH } from "./password-policy";

// OWASP "second recommended option" for Argon2id as of 2025:
// memoryCost 19 MiB, timeCost 2, parallelism 1. Values are expressed in the
// units `@node-rs/argon2` accepts (KiB for memory, iterations for time).
//
// Argon2id is the algorithm we require. Rather than relying on the ambient
// const enum (blocked by `isolatedModules`), we pin the numeric enum value
// expected by `@node-rs/argon2`.
const ARGON2ID_ALGORITHM = 2;

const ARGON2ID_OPTIONS = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

// Re-exported so existing server-side callers (`instance.ts`, tests, etc.)
// that already import from this module keep working. Clients must import
// from `./password-policy` directly since this file is `server-only`.
export { MIN_PASSWORD_LENGTH };

export class PasswordTooShortError extends Error {
  readonly code = "password_too_short" as const;
  constructor() {
    super(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
}

export async function hashPassword(plainText: string): Promise<string> {
  if (plainText.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordTooShortError();
  }
  return hash(plainText, ARGON2ID_OPTIONS);
}

export async function verifyPassword(plainText: string, hashValue: string): Promise<boolean> {
  if (!hashValue.startsWith("$argon2id$")) {
    return false;
  }
  try {
    return await verify(hashValue, plainText);
  } catch {
    return false;
  }
}
