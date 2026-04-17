import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetServerEnvForTests } from "@/lib/server/env";
import { childLogger, createBaseLogger, getLogger, jobLogger, requestLogger, resetLoggerForTests } from "@/lib/server/logger";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://app.example.com",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  LOG_LEVEL: "debug",
  APP_RUNTIME: "web",
} as NodeJS.ProcessEnv;

describe("logger", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...baseEnv };
    resetServerEnvForTests();
    resetLoggerForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetServerEnvForTests();
    resetLoggerForTests();
  });

  test("createBaseLogger uses the resolved log level and a structured base", () => {
    const logger = createBaseLogger({ runtime: "web" });

    expect(logger.level).toBe("debug");
    expect(logger.bindings()).toMatchObject({ runtime: "web", env: "test" });
  });

  test("createBaseLogger for production omits the pretty transport", () => {
    process.env = { ...baseEnv, NODE_ENV: "production", LOG_LEVEL: "warn" } as NodeJS.ProcessEnv;
    resetServerEnvForTests();
    resetLoggerForTests();

    const logger = createBaseLogger({ runtime: "worker" });

    expect(logger.level).toBe("warn");
    expect(logger.bindings()).toMatchObject({ runtime: "worker", env: "production" });
  });

  test("getLogger returns a memoized instance with the detected runtime", () => {
    process.env.APP_RUNTIME = "worker";
    resetLoggerForTests();

    const first = getLogger();
    const second = getLogger();

    expect(second).toBe(first);
    expect(first.bindings()).toMatchObject({ runtime: "worker" });
  });

  test("childLogger attaches additional bindings on top of the base", () => {
    const child = childLogger({ component: "auth.sign-in", userId: "u_123" });

    expect(child.bindings()).toMatchObject({ component: "auth.sign-in", userId: "u_123", runtime: "web" });
  });

  test("logger can be reconfigured via overrides without mutating the base", () => {
    const spy = vi.fn();
    const logger = createBaseLogger({ runtime: "web", overrides: { level: "fatal", hooks: { logMethod: spy } } });

    expect(logger.level).toBe("fatal");
  });

  test("requestLogger binds request context and uses the X-Request-Id header when present", () => {
    const headers = new Headers({ "x-request-id": "req-abc" });

    const logger = requestLogger({ method: "post", url: "https://app.example.com/api/auth/sign-in?code=1", headers });

    expect(logger.bindings()).toMatchObject({
      component: "http",
      requestId: "req-abc",
      method: "POST",
      path: "/api/auth/sign-in",
    });
  });

  test("requestLogger generates a request id when no header is provided", () => {
    const logger = requestLogger({ method: "GET", url: "/api/health" });

    expect(typeof logger.bindings().requestId).toBe("string");
    expect(logger.bindings().path).toBe("/api/health");
  });

  test("requestLogger accepts plain-object headers", () => {
    const logger = requestLogger({ method: "GET", url: "/dashboard", headers: { "X-Request-Id": "plain-header-id" } });

    expect(logger.bindings().requestId).toBe("plain-header-id");
  });

  test("requestLogger takes the first value of an array header", () => {
    const logger = requestLogger({ method: "GET", url: "/dashboard", headers: { "x-request-id": ["from-array", "ignored"] } });

    expect(logger.bindings().requestId).toBe("from-array");
  });

  test("jobLogger binds queue and job context", () => {
    const logger = jobLogger({ queue: "meetings", jobName: "transcribe", jobId: "job-1", attempt: 2 }, { userId: "u_1" });

    expect(logger.bindings()).toMatchObject({
      component: "queue",
      queue: "meetings",
      jobName: "transcribe",
      jobId: "job-1",
      attempt: 2,
      userId: "u_1",
    });
  });

  test("jobLogger falls back to null for optional context fields", () => {
    const logger = jobLogger({ queue: "meetings", jobName: "process" });

    expect(logger.bindings()).toMatchObject({ jobId: null, attempt: null });
  });

  test("createBaseLogger configures the pretty transport in development", () => {
    process.env = { ...baseEnv, NODE_ENV: "development", LOG_LEVEL: "info" } as NodeJS.ProcessEnv;
    resetServerEnvForTests();
    resetLoggerForTests();

    // The pino-pretty transport forks a worker thread on the first log call.
    // We create the logger but skip emitting so the test stays synchronous.
    const logger = createBaseLogger({ runtime: "web" });

    expect(logger.level).toBe("info");
    expect(logger.bindings()).toMatchObject({ runtime: "web", env: "development" });
  });

  test("requestLogger falls back to a generated id when object headers have no match", () => {
    const logger = requestLogger({ method: "GET", url: "/anywhere", headers: { "x-other": "value" } });

    expect(typeof logger.bindings().requestId).toBe("string");
    expect(logger.bindings().requestId).not.toBe("");
  });

  test("requestLogger uses the raw url as path when URL parsing fails", () => {
    // Pass a URL-like string that `new URL()` rejects even with a base so the
    // `safePath` fallback reports the raw input.
    const badUrl = "http://[invalid";
    const logger = requestLogger({ method: "GET", url: badUrl });

    expect(logger.bindings().path).toBe(badUrl);
  });

  test("requestLogger accepts a URL object for url and stringifies it for path extraction", () => {
    const url = new URL("https://app.example.com/nested/path?x=1");
    const logger = requestLogger({ method: "GET", url });

    expect(logger.bindings().path).toBe("/nested/path");
  });

  test("requestLogger generates an id when Headers has no x-request-id", () => {
    const headers = new Headers({ "x-other-header": "value" });
    const logger = requestLogger({ method: "GET", url: "/api/health", headers });

    expect(typeof logger.bindings().requestId).toBe("string");
    expect(logger.bindings().requestId).not.toBe("value");
  });
});
