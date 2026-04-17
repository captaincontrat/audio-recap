import { describe, expect, test } from "vitest";

import { StatusReadRefusedError, type StatusReadRefusalReason, SubmissionRefusedError, type SubmissionRefusalReason } from "@/lib/server/meetings";

const SUBMISSION_REFUSAL_REASONS: SubmissionRefusalReason[] = [
  "not_found",
  "access_denied",
  "workspace_archived",
  "role_not_authorized",
  "media_unsupported",
  "media_missing",
  "media_too_large",
  "notes_too_long",
  "normalization_required_failed",
];

const STATUS_READ_REFUSAL_REASONS: StatusReadRefusalReason[] = ["not_found", "access_denied", "workspace_archived"];

describe("SubmissionRefusedError", () => {
  test("has a default message derived from the reason", () => {
    for (const reason of SUBMISSION_REFUSAL_REASONS) {
      const error = new SubmissionRefusedError(reason);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SubmissionRefusedError);
      expect(error.reason).toBe(reason);
      expect(error.code).toBe("submission_refused");
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  test("accepts a custom message override", () => {
    const error = new SubmissionRefusedError("not_found", "custom");
    expect(error.message).toBe("custom");
  });

  test("throws if a new refusal reason is introduced without updating the default map", () => {
    expect(() => new SubmissionRefusedError("unexpected" as SubmissionRefusalReason)).toThrowError(/Unhandled submission refusal reason/);
  });
});

describe("StatusReadRefusedError", () => {
  test("has a default message derived from the reason", () => {
    for (const reason of STATUS_READ_REFUSAL_REASONS) {
      const error = new StatusReadRefusedError(reason);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StatusReadRefusedError);
      expect(error.reason).toBe(reason);
      expect(error.code).toBe("status_read_refused");
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  test("accepts a custom message override", () => {
    const error = new StatusReadRefusedError("not_found", "custom");
    expect(error.message).toBe("custom");
  });

  test("throws if a new refusal reason is introduced without updating the default map", () => {
    expect(() => new StatusReadRefusedError("unexpected" as StatusReadRefusalReason)).toThrowError(/Unhandled status read refusal reason/);
  });
});
