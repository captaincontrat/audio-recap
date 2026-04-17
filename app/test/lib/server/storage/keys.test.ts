import { describe, expect, test } from "vitest";

import { buildTransientInputKey, sanitizeFilenameSegment, sanitizeUploadId } from "@/lib/server/storage/keys";

describe("transient storage keys", () => {
  test("sanitizes upload ids by trimming and rejecting invalid characters", () => {
    expect(sanitizeUploadId("  upload_123-abc ")).toBe("upload_123-abc");
    expect(() => sanitizeUploadId("bad id")).toThrow(/Invalid uploadId/);
    expect(() => sanitizeUploadId("../escape")).toThrow(/Invalid uploadId/);
    expect(() => sanitizeUploadId("-starts-with-dash")).toThrow(/Invalid uploadId/);
  });

  test("normalizes filename segments and drops blank inputs", () => {
    expect(sanitizeFilenameSegment(undefined)).toBeUndefined();
    expect(sanitizeFilenameSegment("   ")).toBeUndefined();
    expect(sanitizeFilenameSegment("   -- - ")).toBeUndefined();
    expect(sanitizeFilenameSegment("  Meeting Audio.mp3  ")).toBe("Meeting-Audio.mp3");
    expect(sanitizeFilenameSegment("café/audio")).toBe("cafe-audio");
    expect(sanitizeFilenameSegment("a".repeat(200))).toHaveLength(96);
  });

  test("builds namespaced keys per transient input kind", () => {
    expect(buildTransientInputKey({ uploadId: "upload_1", kind: "media", filename: "meeting.m4a" })).toBe("transient-inputs/upload_1/media/meeting.m4a");
    expect(buildTransientInputKey({ uploadId: "upload_1", kind: "media" })).toBe("transient-inputs/upload_1/media/source");
    expect(buildTransientInputKey({ uploadId: "upload_1", kind: "notes" })).toBe("transient-inputs/upload_1/notes/notes.md");
    expect(buildTransientInputKey({ uploadId: "upload_1", kind: "mp3-derivative" })).toBe("transient-inputs/upload_1/mp3-derivative/derivative.mp3");
  });

  test("throws when passed an unknown transient input kind", () => {
    expect(() =>
      buildTransientInputKey({
        uploadId: "upload_1",
        kind: "unsupported" as never,
      }),
    ).toThrow(/Unhandled transient input kind/);
  });
});
