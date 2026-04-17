import { describe, expect, test } from "vitest";

import { generateProcessingJobId, generateTranscriptId, generateUploadId } from "@/lib/server/meetings";

describe("transcript/processing-job/upload id generators", () => {
  test("transcript ids use the trx_ prefix and 22 random chars", () => {
    const id = generateTranscriptId();
    expect(id.startsWith("trx_")).toBe(true);
    expect(id).toMatch(/^trx_[a-zA-Z0-9]{22}$/);
  });

  test("processing job ids use the job_ prefix and 22 random chars", () => {
    const id = generateProcessingJobId();
    expect(id.startsWith("job_")).toBe(true);
    expect(id).toMatch(/^job_[a-zA-Z0-9]{22}$/);
  });

  test("upload ids use the up_ prefix and 24 random chars", () => {
    const id = generateUploadId();
    expect(id.startsWith("up_")).toBe(true);
    expect(id).toMatch(/^up_[a-zA-Z0-9]{24}$/);
  });

  test("consecutive calls do not collide", () => {
    const ids = new Set([generateTranscriptId(), generateTranscriptId(), generateTranscriptId()]);
    expect(ids.size).toBe(3);
  });
});
