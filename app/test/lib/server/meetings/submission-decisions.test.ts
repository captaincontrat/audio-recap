import { describe, expect, test } from "vitest";

import {
  canRoleCreateTranscripts,
  evaluateSubmission,
  SUBMISSION_MAX_MEDIA_BYTES,
  SUBMISSION_MAX_NOTES_BYTES,
  type SubmissionInputs,
} from "@/lib/server/meetings";

function baseInputs(overrides: Partial<SubmissionInputs> = {}): SubmissionInputs {
  return {
    role: "member",
    workspaceActive: true,
    mediaKind: "audio",
    mediaBytes: 10_000_000,
    mediaContentType: "audio/mpeg",
    notesBytes: 0,
    normalizationPolicy: "optional",
    normalization: { kind: "unavailable" },
    ...overrides,
  };
}

describe("canRoleCreateTranscripts", () => {
  test("members and admins can submit", () => {
    expect(canRoleCreateTranscripts("member")).toBe(true);
    expect(canRoleCreateTranscripts("admin")).toBe(true);
  });

  test("read_only cannot submit", () => {
    expect(canRoleCreateTranscripts("read_only")).toBe(false);
  });
});

describe("evaluateSubmission", () => {
  test("refuses archived workspaces before any other check", () => {
    const result = evaluateSubmission(baseInputs({ workspaceActive: false }));
    expect(result).toEqual({ kind: "refused", reason: "workspace_archived" });
  });

  test("refuses read_only roles", () => {
    const result = evaluateSubmission(baseInputs({ role: "read_only" }));
    expect(result).toEqual({ kind: "refused", reason: "role_not_authorized" });
  });

  test("refuses media that exceeds the size limit", () => {
    const result = evaluateSubmission(baseInputs({ mediaBytes: SUBMISSION_MAX_MEDIA_BYTES + 1 }));
    expect(result).toEqual({ kind: "refused", reason: "media_too_large" });
  });

  test("refuses unsupported content types", () => {
    const result = evaluateSubmission(baseInputs({ mediaContentType: "application/pdf" }));
    expect(result).toEqual({ kind: "refused", reason: "media_unsupported" });
  });

  test("refuses oversized notes", () => {
    const result = evaluateSubmission(baseInputs({ notesBytes: SUBMISSION_MAX_NOTES_BYTES + 1 }));
    expect(result).toEqual({ kind: "refused", reason: "notes_too_long" });
  });

  test("accepts normalized mp3 derivative regardless of policy", () => {
    const result = evaluateSubmission(baseInputs({ normalization: { kind: "succeeded", inputKind: "mp3-derivative" }, normalizationPolicy: "required" }));
    expect(result).toEqual({ kind: "accepted", inputKind: "mp3-derivative" });
  });

  test("accepts original upload when normalization is unavailable in optional policy", () => {
    const result = evaluateSubmission(baseInputs({ normalization: { kind: "unavailable" }, normalizationPolicy: "optional" }));
    expect(result).toEqual({ kind: "accepted", inputKind: "original" });
  });

  test("accepts original upload when normalization failed in optional policy", () => {
    const result = evaluateSubmission(baseInputs({ normalization: { kind: "failed" }, normalizationPolicy: "optional" }));
    expect(result).toEqual({ kind: "accepted", inputKind: "original" });
  });

  test("refuses unavailable normalization in required policy", () => {
    const result = evaluateSubmission(baseInputs({ normalization: { kind: "unavailable" }, normalizationPolicy: "required" }));
    expect(result).toEqual({ kind: "refused", reason: "normalization_required_failed" });
  });

  test("refuses failed normalization in required policy", () => {
    const result = evaluateSubmission(baseInputs({ normalization: { kind: "failed" }, normalizationPolicy: "required" }));
    expect(result).toEqual({ kind: "refused", reason: "normalization_required_failed" });
  });

  test("refuses missing media kind", () => {
    const result = evaluateSubmission(baseInputs({ mediaKind: null }));
    expect(result).toEqual({ kind: "refused", reason: "media_missing" });
  });

  test("refuses empty media payloads as missing rather than oversized", () => {
    const result = evaluateSubmission(baseInputs({ mediaBytes: 0 }));
    expect(result).toEqual({ kind: "refused", reason: "media_missing" });
  });

  test("refuses null content types when normalization did not produce an mp3 derivative", () => {
    const result = evaluateSubmission(baseInputs({ mediaContentType: null }));
    expect(result).toEqual({ kind: "refused", reason: "media_unsupported" });
  });

  test("accepts supported video content types", () => {
    const result = evaluateSubmission(baseInputs({ mediaKind: "video", mediaContentType: "video/mp4" }));
    expect(result).toEqual({ kind: "accepted", inputKind: "original" });
  });

  test("refuses unsupported video content types", () => {
    const result = evaluateSubmission(baseInputs({ mediaKind: "video", mediaContentType: "video/avi" }));
    expect(result).toEqual({ kind: "refused", reason: "media_unsupported" });
  });

  test("normalizes content type casing and strips parameters before comparison", () => {
    const result = evaluateSubmission(baseInputs({ mediaContentType: "Audio/MPEG; charset=utf-8" }));
    expect(result).toEqual({ kind: "accepted", inputKind: "original" });
  });

  test("throws if a new normalization outcome kind is introduced without updating the policy map", () => {
    const bogus = { kind: "bogus" } as unknown as SubmissionInputs["normalization"];
    expect(() => evaluateSubmission(baseInputs({ normalization: bogus }))).toThrowError(/Unhandled normalization outcome/);
  });
});
