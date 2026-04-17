import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { getServerEnv, resetServerEnvForTests } from "@/lib/server/env";

function validSource(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: "a".repeat(32),
    BETTER_AUTH_URL: "https://app.example.com",
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("getServerEnv", () => {
  beforeEach(() => {
    resetServerEnvForTests();
  });

  afterEach(() => {
    resetServerEnvForTests();
  });

  test("parses a valid environment and applies defaults", () => {
    const env = getServerEnv(validSource());

    expect(env.NODE_ENV).toBe("test");
    expect(env.BETTER_AUTH_URL).toBe("https://app.example.com");
    expect(env.EMAIL_PROVIDER).toBe("console");
    expect(env.EMAIL_FROM).toBe("no-reply@summitdown.local");
    expect(env.AWS_REGION).toBe("eu-west-3");
    expect(env.LOG_LEVEL).toBe("info");
  });

  test("caches the parsed env on subsequent calls", () => {
    const first = getServerEnv(validSource({ LOG_LEVEL: "debug" }));
    const second = getServerEnv(validSource({ LOG_LEVEL: "error" }));

    expect(second).toBe(first);
    expect(second.LOG_LEVEL).toBe("debug");
  });

  test("throws a descriptive error when validation fails", () => {
    expect(() => getServerEnv(validSource({ BETTER_AUTH_SECRET: "too-short" }))).toThrow(/BETTER_AUTH_SECRET/);
  });

  test("throws when required URLs are missing", () => {
    const source = validSource();
    delete source.DATABASE_URL;

    expect(() => getServerEnv(source)).toThrow(/DATABASE_URL/);
  });

  test("surfaces root-level schema issues with a readable path", () => {
    const source = validSource({ EMAIL_PROVIDER: "not-a-provider" as unknown as string });

    expect(() => getServerEnv(source)).toThrow(/EMAIL_PROVIDER/);
  });

  test("resetServerEnvForTests clears the cache", () => {
    const first = getServerEnv(validSource({ LOG_LEVEL: "debug" }));
    resetServerEnvForTests();
    const second = getServerEnv(validSource({ LOG_LEVEL: "error" }));

    expect(second).not.toBe(first);
    expect(second.LOG_LEVEL).toBe("error");
  });

  test("labels root-level validation issues with the <root> sentinel", () => {
    // Zod emits an `invalid_type` issue with an empty `path` when the whole
    // input is the wrong shape (e.g., passing `null` instead of an object).
    // This exercises the "`<root>`" fallback in the error message builder.
    expect(() => getServerEnv(null as unknown as NodeJS.ProcessEnv)).toThrow(/<root>/);
  });
});
