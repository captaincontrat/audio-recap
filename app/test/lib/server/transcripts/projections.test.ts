import { describe, expect, test } from "vitest";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { type TranscriptSummaryRow, toDetailView, toLibraryItem } from "@/lib/server/transcripts/projections";

function makeRow(overrides: Partial<TranscriptRow> = {}): TranscriptRow {
  return {
    id: "transcript_1",
    workspaceId: "workspace_1",
    createdByUserId: "user_1",
    status: "completed",
    title: "Team sync",
    transcriptMarkdown: "# Transcript\n\nHello world.",
    recapMarkdown: "## Recap\n\n- Point one",
    sourceMediaKind: "audio",
    originalDurationSec: 1234.5,
    submittedWithNotes: true,
    failureCode: null,
    failureSummary: null,
    createdAt: new Date("2026-04-01T10:00:00.000Z"),
    updatedAt: new Date("2026-04-02T11:00:00.000Z"),
    completedAt: new Date("2026-04-03T12:00:00.000Z"),
    ...overrides,
  };
}

function makeSummary(overrides: Partial<TranscriptSummaryRow> = {}): TranscriptSummaryRow {
  return {
    id: "transcript_summary_1",
    workspaceId: "workspace_1",
    status: "completed",
    title: "Project kickoff",
    sourceMediaKind: "video",
    submittedWithNotes: false,
    createdAt: new Date("2026-04-05T08:00:00.000Z"),
    updatedAt: new Date("2026-04-05T09:15:00.000Z"),
    completedAt: new Date("2026-04-05T09:30:00.000Z"),
    ...overrides,
  };
}

describe("toLibraryItem", () => {
  test("maps a summary row to the library projection with displayTitle and ISO timestamps", () => {
    const row = makeSummary();
    expect(toLibraryItem(row)).toEqual({
      id: "transcript_summary_1",
      workspaceId: "workspace_1",
      status: "completed",
      displayTitle: "Project kickoff",
      sourceMediaKind: "video",
      submittedWithNotes: false,
      createdAt: "2026-04-05T08:00:00.000Z",
      updatedAt: "2026-04-05T09:15:00.000Z",
      completedAt: "2026-04-05T09:30:00.000Z",
    });
  });

  test("falls back to the untitled placeholder for a blank processing title", () => {
    const row = makeSummary({ title: "   " });
    expect(toLibraryItem(row).displayTitle).toBe("Untitled transcript");
  });

  test("preserves null completedAt (job still in flight)", () => {
    const row = makeSummary({ completedAt: null, status: "transcribing" });
    const item = toLibraryItem(row);
    expect(item.completedAt).toBeNull();
    expect(item.status).toBe("transcribing");
  });

  test("never leaks transcript or recap content fields", () => {
    const row = makeSummary();
    const item = toLibraryItem(row);
    expect(item).not.toHaveProperty("transcriptMarkdown");
    expect(item).not.toHaveProperty("recapMarkdown");
    expect(item).not.toHaveProperty("failureCode");
    expect(item).not.toHaveProperty("failureSummary");
  });
});

describe("toDetailView", () => {
  test("maps a full transcript row to the detail projection", () => {
    const row = makeRow();
    expect(toDetailView(row)).toEqual({
      id: "transcript_1",
      workspaceId: "workspace_1",
      status: "completed",
      displayTitle: "Team sync",
      transcriptMarkdown: "# Transcript\n\nHello world.",
      recapMarkdown: "## Recap\n\n- Point one",
      sourceMediaKind: "audio",
      originalDurationSec: 1234.5,
      submittedWithNotes: true,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-02T11:00:00.000Z",
      completedAt: "2026-04-03T12:00:00.000Z",
      failure: null,
    });
  });

  test("returns a failure summary payload when the transcript has terminated in failure", () => {
    const row = makeRow({
      status: "failed",
      failureCode: "processing_failed",
      failureSummary: "Transcription provider rejected the upload",
      completedAt: null,
    });
    const detail = toDetailView(row);
    expect(detail.failure).toEqual({
      code: "processing_failed",
      summary: "Transcription provider rejected the upload",
    });
    expect(detail.status).toBe("failed");
    expect(detail.completedAt).toBeNull();
  });

  test("keeps failure.summary nullable when only the code is known", () => {
    const row = makeRow({ status: "failed", failureCode: "validation_failed", failureSummary: null });
    expect(toDetailView(row).failure).toEqual({ code: "validation_failed", summary: null });
  });

  test("falls back to the untitled placeholder for a blank title", () => {
    const row = makeRow({ title: "" });
    expect(toDetailView(row).displayTitle).toBe("Untitled transcript");
  });

  test("never leaks raw processing metadata (e.g., failureCode on the row itself is repackaged, not re-exported)", () => {
    const detail = toDetailView(makeRow());
    expect(detail).not.toHaveProperty("failureCode");
    expect(detail).not.toHaveProperty("failureSummary");
    expect(detail).not.toHaveProperty("createdByUserId");
  });

  test("keeps originalDurationSec nullable when probing failed", () => {
    const row = makeRow({ originalDurationSec: null });
    expect(toDetailView(row).originalDurationSec).toBeNull();
  });
});
