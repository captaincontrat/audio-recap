import { describe, expect, test } from "vitest";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { type StatusReadRefusedError, statusReadRefusalToHttpStatus, toStatusView } from "@/lib/server/meetings";

function baseRow(overrides: Partial<TranscriptRow> = {}): TranscriptRow {
  const createdAt = new Date("2026-04-18T00:00:00.000Z");
  const updatedAt = new Date("2026-04-18T00:01:00.000Z");
  return {
    id: "trx_test",
    workspaceId: "ws_1",
    createdByUserId: "user_1",
    status: "queued",
    title: "",
    customTitle: null,
    transcriptMarkdown: "",
    recapMarkdown: "",
    tags: [],
    tagSortKey: null,
    isImportant: false,
    sourceMediaKind: "audio",
    originalDurationSec: null,
    submittedWithNotes: false,
    failureCode: null,
    failureSummary: null,
    createdAt,
    updatedAt,
    completedAt: null,
    ...overrides,
  };
}

describe("toStatusView", () => {
  test("returns null title/hasRecap while the transcript is still processing", () => {
    const view = toStatusView(baseRow({ status: "transcribing", title: "draft", recapMarkdown: "not yet" }));
    expect(view.title).toBeNull();
    expect(view.hasRecap).toBe(false);
    expect(view.status).toBe("transcribing");
    expect(view.failure).toBeNull();
  });

  test("exposes title and hasRecap=true once completed with content", () => {
    const completedAt = new Date("2026-04-18T00:05:00.000Z");
    const view = toStatusView(baseRow({ status: "completed", title: "Weekly sync", recapMarkdown: "## Summary", completedAt }));
    expect(view.title).toBe("Weekly sync");
    expect(view.hasRecap).toBe(true);
    expect(view.completedAt).toBe(completedAt.toISOString());
  });

  test("reports hasRecap=false when completed with empty recap", () => {
    const view = toStatusView(baseRow({ status: "completed", title: "T", recapMarkdown: "" }));
    expect(view.hasRecap).toBe(false);
    expect(view.title).toBe("T");
  });

  test("includes failure code and summary when failure metadata is set", () => {
    const view = toStatusView(
      baseRow({
        status: "failed",
        failureCode: "processing_failed",
        failureSummary: "We couldn't complete processing. Please retry.",
      }),
    );
    expect(view.failure).toEqual({
      code: "processing_failed",
      summary: "We couldn't complete processing. Please retry.",
    });
  });

  test("covers validation_failed failure family too", () => {
    const view = toStatusView(baseRow({ status: "failed", failureCode: "validation_failed", failureSummary: null }));
    expect(view.failure).toEqual({ code: "validation_failed", summary: null });
  });

  test("serialises timestamps as ISO strings", () => {
    const view = toStatusView(baseRow());
    expect(view.createdAt).toBe("2026-04-18T00:00:00.000Z");
    expect(view.updatedAt).toBe("2026-04-18T00:01:00.000Z");
    expect(view.completedAt).toBeNull();
  });
});

describe("statusReadRefusalToHttpStatus", () => {
  test("maps each refusal reason to its HTTP status", () => {
    expect(statusReadRefusalToHttpStatus("not_found")).toBe(404);
    expect(statusReadRefusalToHttpStatus("access_denied")).toBe(403);
    expect(statusReadRefusalToHttpStatus("workspace_archived")).toBe(409);
  });

  test("throws for an unexpected refusal reason", () => {
    expect(() => statusReadRefusalToHttpStatus("unexpected" as StatusReadRefusedError["reason"])).toThrowError(/Unhandled status read refusal reason/);
  });
});
