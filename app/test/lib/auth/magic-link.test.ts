import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { sendMagicLinkEmail } from "@/lib/auth/magic-link";
import { setEmailAdapterForTests } from "@/lib/server/email/factory";
import { clearCapturedEmails, getCapturedEmails, MemoryEmailAdapter } from "@/lib/server/email/memory";
import { resetServerEnvForTests } from "@/lib/server/env";

// Tests run in the unified jsdom environment, so `getServerEnv()` inside
// `sendMagicLinkEmail` resolves against `process.env`. We populate the
// required keys for the duration of each test and restore the previous
// values afterwards so we don't leak state between suites.
function withRequiredEnv<T>(run: () => T): T {
  const snapshot: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  };

  // Cast to the mutable `Record<string, string | undefined>` shape because
  // some of these keys (e.g. `NODE_ENV`) are typed as readonly on the
  // shared `NodeJS.ProcessEnv` interface.
  const mutableEnv = process.env as Record<string, string | undefined>;
  mutableEnv.NODE_ENV = "test";
  mutableEnv.BETTER_AUTH_SECRET = "a".repeat(32);
  mutableEnv.BETTER_AUTH_URL = "https://app.example.com";
  mutableEnv.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
  mutableEnv.REDIS_URL = "redis://localhost:6379";
  mutableEnv.EMAIL_PROVIDER = "memory";

  try {
    return run();
  } finally {
    const mutableEnv = process.env as Record<string, string | undefined>;
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete mutableEnv[key];
      } else {
        mutableEnv[key] = value;
      }
    }
  }
}

describe("sendMagicLinkEmail", () => {
  beforeEach(() => {
    resetServerEnvForTests();
    clearCapturedEmails();
    setEmailAdapterForTests(new MemoryEmailAdapter());
  });

  afterEach(() => {
    resetServerEnvForTests();
    clearCapturedEmails();
    setEmailAdapterForTests(undefined);
  });

  test("forwards the recipient, URL, and user name to the email adapter", async () => {
    await withRequiredEnv(async () => {
      await sendMagicLinkEmail({
        to: "ada@example.com",
        url: "https://app.example.com/api/auth/magic-link/verify?token=abc",
        userName: "Ada",
      });

      const [email] = getCapturedEmails("ada@example.com");
      expect(email?.type).toBe("magic-link");
      expect(email?.subject).toBe("Your Summitdown sign-in link");
      expect(email?.url).toBe("https://app.example.com/api/auth/magic-link/verify?token=abc");
      expect(email?.text).toContain("Hi Ada,");
    });
  });

  test("sends an anonymous greeting when no userName is supplied (new-account flow)", async () => {
    await withRequiredEnv(async () => {
      await sendMagicLinkEmail({
        to: "unknown@example.com",
        url: "https://app.example.com/api/auth/magic-link/verify?token=xyz",
      });

      const [email] = getCapturedEmails("unknown@example.com");
      expect(email?.text.startsWith("Hi,")).toBe(true);
      expect(email?.text).toContain("https://app.example.com/api/auth/magic-link/verify?token=xyz");
    });
  });

  test("treats an explicit null userName identically to a missing one", async () => {
    await withRequiredEnv(async () => {
      await sendMagicLinkEmail({
        to: "ada@example.com",
        url: "https://app.example.com/api/auth/magic-link/verify?token=abc",
        userName: null,
      });

      const [email] = getCapturedEmails("ada@example.com");
      expect(email?.text.startsWith("Hi,")).toBe(true);
    });
  });
});
