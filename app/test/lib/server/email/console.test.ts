import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ConsoleEmailAdapter } from "@/lib/server/email/console";
import { resetServerEnvForTests } from "@/lib/server/env";
import { resetLoggerForTests } from "@/lib/server/logger";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://app.example.com",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  LOG_LEVEL: "debug",
} as NodeJS.ProcessEnv;

describe("ConsoleEmailAdapter", () => {
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

  test("invokes the provided sink with rendered subject and text", async () => {
    const sink = vi.fn();
    const adapter = new ConsoleEmailAdapter({ from: "no-reply@test", sink });

    const result = await adapter.send({
      type: "verification",
      to: "user@example.com",
      url: "https://app.example.com/verify?token=abc",
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "verification", to: "user@example.com" }),
      expect.objectContaining({ subject: "Verify your Summitdown email address" }),
    );
    expect(result.id).toMatch(/^console-\d+/);
  });

  test("uses a logging sink by default that renders the subject", async () => {
    const adapter = new ConsoleEmailAdapter({ from: "no-reply@test" });
    const result = await adapter.send({
      type: "password-reset",
      to: "user@example.com",
      url: "https://app.example.com/reset?token=xyz",
    });

    expect(result.id).toMatch(/^console-\d+/);
  });
});
