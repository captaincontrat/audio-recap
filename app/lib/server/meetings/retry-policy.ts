import type { TranscriptFailureCode } from "@/lib/server/db/schema";

// Pure helpers that classify worker failures into retryable vs
// terminal outcomes and compute the next attempt count. Kept outside
// the worker-glue module so the rules are unit-tested without touching
// BullMQ or Postgres.

export const DEFAULT_MAX_ATTEMPTS = 3;

// Delay (in milliseconds) applied when a retryable worker failure is
// re-enqueued. Kept as a single source of truth so the worker and the
// queue orchestration stay aligned. Chosen to give transient provider
// outages time to recover without forcing end users to wait more than
// ~90 seconds across all three attempts.
export const QUEUE_RETRY_DELAY_MS = 15_000;

// `validation` marks non-retryable upstream issues (unusable media,
// missing content), while `infrastructure` covers retryable transient
// failures (network blips, provider hiccups, 5xx responses). The
// worker decides which bucket applies based on the stage and error
// shape; the classifier below only needs the bucket to reach a
// decision.
export type FailureKind = "validation" | "infrastructure";

export type RetryDecision = { kind: "retry"; nextAttempt: number } | { kind: "fail_terminal"; failureCode: TranscriptFailureCode };

export type RetryDecisionInputs = {
  failureKind: FailureKind;
  attempts: number;
  maxAttempts: number;
};

// Classify the next action after a failed attempt. Validation
// failures are never retried. Infrastructure failures are retried
// until the attempt budget is exhausted, at which point the transcript
// moves to terminal failure with the generic `processing_failed` code.
export function classifyRetry(inputs: RetryDecisionInputs): RetryDecision {
  if (inputs.failureKind === "validation") {
    return { kind: "fail_terminal", failureCode: "validation_failed" };
  }
  const nextAttempt = inputs.attempts + 1;
  if (nextAttempt >= inputs.maxAttempts) {
    return { kind: "fail_terminal", failureCode: "processing_failed" };
  }
  return { kind: "retry", nextAttempt };
}

// Map a failure code to the short generic summary the status surface
// renders for end users. Kept stable so copy changes do not require
// code changes outside this module.
export function defaultFailureSummary(code: TranscriptFailureCode): string {
  switch (code) {
    case "validation_failed":
      return "The submitted media could not be validated as usable meeting audio.";
    case "processing_failed":
      return "Processing could not be completed after multiple attempts.";
    default: {
      const exhaustive: never = code;
      throw new Error(`Unhandled failure code: ${String(exhaustive)}`);
    }
  }
}
