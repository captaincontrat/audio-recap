import { describe, expect, test } from "vitest";

import { toUploadManagerRehydrationItem, type UploadManagerRehydrationRow } from "@/lib/server/meetings";

function baseRow(overrides: Partial<UploadManagerRehydrationRow> = {}): UploadManagerRehydrationRow {
  return {
    id: "trx_test",
    status: "queued",
    title: "",
    failureSummary: null,
    sourceMediaKind: "audio",
    createdAt: new Date("2026-04-18T00:00:00.000Z"),
    updatedAt: new Date("2026-04-18T00:01:00.000Z"),
    ...overrides,
  };
}

describe("toUploadManagerRehydrationItem", () => {
  test("exposes the worker-supplied title once the transcript is completed", () => {
    const item = toUploadManagerRehydrationItem(baseRow({ status: "completed", title: "Weekly sync" }));
    expect(item.title).toBe("Weekly sync");
    expect(item.status).toBe("completed");
  });

  test("hides the worker-supplied placeholder title for in-flight rows", () => {
    const item = toUploadManagerRehydrationItem(baseRow({ status: "transcribing", title: "kickoff.mp3" }));
    expect(item.title).toBeNull();
    expect(item.status).toBe("transcribing");
  });

  test("hides the worker-supplied title for failed rows so the tray reads from failure summary instead", () => {
    const item = toUploadManagerRehydrationItem(baseRow({ status: "failed", title: "kickoff.mp3", failureSummary: "We couldn't complete processing." }));
    expect(item.title).toBeNull();
    expect(item.failureSummary).toBe("We couldn't complete processing.");
  });

  test("preserves the failureSummary as-is (including null) for non-failed rows", () => {
    const item = toUploadManagerRehydrationItem(baseRow({ status: "preprocessing", failureSummary: null }));
    expect(item.failureSummary).toBeNull();
  });

  test("forwards sourceMediaKind for both audio and video rows", () => {
    const audio = toUploadManagerRehydrationItem(baseRow({ sourceMediaKind: "audio" }));
    const video = toUploadManagerRehydrationItem(baseRow({ sourceMediaKind: "video" }));
    expect(audio.sourceMediaKind).toBe("audio");
    expect(video.sourceMediaKind).toBe("video");
  });

  test("serialises createdAt and updatedAt as ISO strings", () => {
    const item = toUploadManagerRehydrationItem(baseRow());
    expect(item.createdAt).toBe("2026-04-18T00:00:00.000Z");
    expect(item.updatedAt).toBe("2026-04-18T00:01:00.000Z");
  });

  test("preserves the row id", () => {
    const item = toUploadManagerRehydrationItem(baseRow({ id: "trx_abc123" }));
    expect(item.id).toBe("trx_abc123");
  });
});
