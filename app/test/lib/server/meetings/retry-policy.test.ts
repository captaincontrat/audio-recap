import { describe, expect, test } from "vitest";

import { classifyRetry, DEFAULT_MAX_ATTEMPTS, defaultFailureSummary, QUEUE_RETRY_DELAY_MS } from "@/lib/server/meetings";
import type { TranscriptFailureCode } from "@/lib/server/db/schema";

describe("classifyRetry", () => {
  test("validation failures fail terminally on the first attempt", () => {
    expect(classifyRetry({ failureKind: "validation", attempts: 1, maxAttempts: DEFAULT_MAX_ATTEMPTS })).toEqual({
      kind: "fail_terminal",
      failureCode: "validation_failed",
    });
  });

  test("infrastructure failures retry until budget is exhausted", () => {
    expect(classifyRetry({ failureKind: "infrastructure", attempts: 1, maxAttempts: 3 })).toEqual({ kind: "retry", nextAttempt: 2 });
    expect(classifyRetry({ failureKind: "infrastructure", attempts: 2, maxAttempts: 3 })).toEqual({
      kind: "fail_terminal",
      failureCode: "processing_failed",
    });
    expect(classifyRetry({ failureKind: "infrastructure", attempts: 3, maxAttempts: 3 })).toEqual({
      kind: "fail_terminal",
      failureCode: "processing_failed",
    });
  });
});

describe("defaultFailureSummary", () => {
  test("is stable for each failure code", () => {
    expect(defaultFailureSummary("validation_failed")).toMatch(/validated/);
    expect(defaultFailureSummary("processing_failed")).toMatch(/multiple attempts/);
  });

  test("throws if a new failure code is added without updating the summary map", () => {
    expect(() => defaultFailureSummary("unexpected" as TranscriptFailureCode)).toThrowError(/Unhandled failure code/);
  });
});

describe("retry policy constants", () => {
  test("DEFAULT_MAX_ATTEMPTS is 3 per the spec", () => {
    expect(DEFAULT_MAX_ATTEMPTS).toBe(3);
  });

  test("QUEUE_RETRY_DELAY_MS is a positive finite number", () => {
    expect(Number.isFinite(QUEUE_RETRY_DELAY_MS)).toBe(true);
    expect(QUEUE_RETRY_DELAY_MS).toBeGreaterThan(0);
  });
});
