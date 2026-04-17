import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AcceptancePlanTokenError, signAcceptancePlan, verifyAcceptancePlan, type AcceptancePlan } from "@/lib/server/meetings";
import { resetServerEnvForTests } from "@/lib/server/env";

const TEST_SECRET = "a".repeat(48);

const TEST_ENV = {
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: TEST_SECRET,
  BETTER_AUTH_URL: "https://app.example.com",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
} as const;

// Replicates the private signing helper in `plan-token.ts` so tests can
// fabricate correctly-signed tokens with arbitrary bodies. Any drift in
// the domain separator or hash algorithm will fail the round-trip tests
// first, alerting us to update both sides.
function signBody(body: string): string {
  const h = createHmac("sha256", TEST_SECRET);
  h.update("meeting-acceptance-plan.v1");
  h.update("\n");
  h.update(body);
  return h.digest().toString("base64url");
}

function samplePlan(): AcceptancePlan {
  return {
    workspaceId: "ws_123",
    createdByUserId: "user_1",
    resolvedMediaInputKind: "original",
    mediaNormalizationPolicySnapshot: "optional",
    sourceMediaKind: "audio",
    mediaContentType: "audio/mpeg",
    submittedWithNotes: false,
    prepared: {
      uploadId: "up_abc",
      mediaInputKey: "transient-inputs/up_abc/media/source",
      notesInputKey: null,
    },
  };
}

describe("signAcceptancePlan / verifyAcceptancePlan", () => {
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    const env = process.env as Record<string, string | undefined>;
    for (const key of Object.keys(TEST_ENV) as Array<keyof typeof TEST_ENV>) {
      previousEnv[key] = env[key];
      env[key] = TEST_ENV[key];
    }
    resetServerEnvForTests();
  });

  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
    resetServerEnvForTests();
  });

  test("roundtrips a plan for the same user within the TTL", () => {
    const now = new Date("2026-04-18T00:00:00.000Z");
    const token = signAcceptancePlan({ plan: samplePlan(), userId: "user_1", ttlSeconds: 900, now });
    const verified = verifyAcceptancePlan({ token, userId: "user_1", now });
    expect(verified.plan).toEqual(samplePlan());
    expect(verified.userId).toBe("user_1");
    expect(verified.expiresAt.getTime() - now.getTime()).toBe(900_000);
    expect(verified.issuedAt.getTime()).toBe(now.getTime());
  });

  test("rejects tokens missing the signature segment", () => {
    try {
      verifyAcceptancePlan({ token: "nosignature", userId: "user_1" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("malformed");
    }
  });

  test("rejects tokens with more than two segments", () => {
    try {
      verifyAcceptancePlan({ token: "a.b.c", userId: "user_1" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("malformed");
    }
  });

  test("rejects tampered signatures", () => {
    const token = signAcceptancePlan({ plan: samplePlan(), userId: "user_1", ttlSeconds: 900 });
    const [body, originalSignature] = token.split(".") as [string, string];
    const tampered = `${body}.${"x".repeat(originalSignature.length)}`;
    try {
      verifyAcceptancePlan({ token: tampered, userId: "user_1" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("invalid_signature");
    }
  });

  test("rejects a signature of a different length", () => {
    const token = signAcceptancePlan({ plan: samplePlan(), userId: "user_1", ttlSeconds: 900 });
    const [body] = token.split(".") as [string, string];
    try {
      verifyAcceptancePlan({ token: `${body}.short`, userId: "user_1" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("invalid_signature");
    }
  });

  test("rejects expired tokens", () => {
    const issuedAt = new Date("2026-04-18T00:00:00.000Z");
    const later = new Date("2026-04-18T00:16:00.000Z");
    const token = signAcceptancePlan({ plan: samplePlan(), userId: "user_1", ttlSeconds: 900, now: issuedAt });
    try {
      verifyAcceptancePlan({ token, userId: "user_1", now: later });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("expired");
    }
  });

  test("rejects tokens issued to another user", () => {
    const token = signAcceptancePlan({ plan: samplePlan(), userId: "user_1", ttlSeconds: 900 });
    try {
      verifyAcceptancePlan({ token, userId: "user_2" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("user_mismatch");
    }
  });

  test("rejects tokens with a future version", () => {
    const body = Buffer.from(JSON.stringify({ v: 99, iat: Date.now(), exp: Date.now() + 60_000, userId: "user_1", plan: samplePlan() }), "utf8").toString(
      "base64url",
    );
    const token = `${body}.${signBody(body)}`;
    try {
      verifyAcceptancePlan({ token, userId: "user_1" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("version_mismatch");
    }
  });

  test("rejects tokens whose body is valid base64 but invalid JSON", () => {
    const body = Buffer.from("this-is-not-json", "utf8").toString("base64url");
    const token = `${body}.${signBody(body)}`;
    try {
      verifyAcceptancePlan({ token, userId: "user_1" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("malformed");
    }
  });

  test("rejects tokens whose exp is not a number", () => {
    const body = Buffer.from(JSON.stringify({ v: 1, iat: Date.now(), exp: "not-a-number", userId: "user_1", plan: samplePlan() }), "utf8").toString(
      "base64url",
    );
    const token = `${body}.${signBody(body)}`;
    try {
      verifyAcceptancePlan({ token, userId: "user_1" });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AcceptancePlanTokenError);
      expect((error as AcceptancePlanTokenError).code).toBe("expired");
    }
  });

  test("AcceptancePlanTokenError accepts a custom message", () => {
    const error = new AcceptancePlanTokenError("malformed", "custom");
    expect(error.message).toBe("custom");
    expect(error.code).toBe("malformed");
    expect(error.name).toBe("AcceptancePlanTokenError");
  });
});
