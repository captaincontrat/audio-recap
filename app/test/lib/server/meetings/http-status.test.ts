import { describe, expect, test } from "vitest";

import { statusReadRefusalToHttpStatus, submissionRefusalToHttpStatus, type SubmissionRefusalReason } from "@/lib/server/meetings";
import type { StatusReadRefusedError } from "@/lib/server/meetings";

const SUBMISSION_MAPPINGS: Array<{ reason: SubmissionRefusalReason; status: number }> = [
  { reason: "not_found", status: 404 },
  { reason: "access_denied", status: 403 },
  { reason: "workspace_archived", status: 409 },
  { reason: "role_not_authorized", status: 403 },
  { reason: "media_missing", status: 400 },
  { reason: "media_unsupported", status: 400 },
  { reason: "media_too_large", status: 400 },
  { reason: "notes_too_long", status: 400 },
  { reason: "normalization_required_failed", status: 400 },
];

describe("submissionRefusalToHttpStatus", () => {
  for (const { reason, status } of SUBMISSION_MAPPINGS) {
    test(`maps ${reason} to HTTP ${status}`, () => {
      expect(submissionRefusalToHttpStatus(reason)).toBe(status);
    });
  }

  test("throws for an unexpected refusal reason so new cases are caught at review time", () => {
    expect(() => submissionRefusalToHttpStatus("unexpected" as SubmissionRefusalReason)).toThrowError(/Unhandled refusal reason/);
  });
});

describe("statusReadRefusalToHttpStatus exhaustive mapping", () => {
  test("covers every status-read refusal reason", () => {
    const mapping: Array<{ reason: StatusReadRefusedError["reason"]; status: number }> = [
      { reason: "not_found", status: 404 },
      { reason: "access_denied", status: 403 },
      { reason: "workspace_archived", status: 409 },
    ];
    for (const { reason, status } of mapping) {
      expect(statusReadRefusalToHttpStatus(reason)).toBe(status);
    }
  });
});
