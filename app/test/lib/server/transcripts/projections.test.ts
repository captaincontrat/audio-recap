import { describe, expect, test } from "vitest";

import type { TranscriptRow } from "@/lib/server/db/schema";
import { buildSharePath, type TranscriptSummaryRow, toDetailView, toLibraryItem } from "@/lib/server/transcripts/projections";

function makeRow(overrides: Partial<TranscriptRow> = {}): TranscriptRow {
  return {
    id: "transcript_1",
    workspaceId: "workspace_1",
    createdByUserId: "user_1",
    status: "completed",
    title: "Team sync",
    customTitle: null,
    transcriptMarkdown: "# Transcript\n\nHello world.",
    recapMarkdown: "## Recap\n\n- Point one",
    tags: [],
    tagSortKey: null,
    isImportant: false,
    isPubliclyShared: false,
    publicShareId: null,
    shareSecretId: null,
    shareUpdatedAt: null,
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
    customTitle: null,
    tags: [],
    isImportant: false,
    isPubliclyShared: false,
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
      tags: [],
      isImportant: false,
      isPubliclyShared: false,
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

  test("prefers customTitle over processing title when an override is set", () => {
    const row = makeSummary({ title: "Project kickoff", customTitle: "Alpha kickoff" });
    expect(toLibraryItem(row).displayTitle).toBe("Alpha kickoff");
  });

  test("falls back to processing title when customTitle is blank after trim", () => {
    const row = makeSummary({ title: "Project kickoff", customTitle: "   " });
    expect(toLibraryItem(row).displayTitle).toBe("Project kickoff");
  });

  test("passes through tags and isImportant from the summary row", () => {
    const row = makeSummary({ tags: ["alpha", "beta"], isImportant: true });
    const item = toLibraryItem(row);
    expect(item.tags).toEqual(["alpha", "beta"]);
    expect(item.isImportant).toBe(true);
  });

  test("passes through isPubliclyShared from the summary row", () => {
    // Library cards only need the boolean state; the full public
    // URL stays on the detail projection so a drive-by library
    // response cannot leak the rotatable secret to every workspace
    // user on every page load.
    const shared = toLibraryItem(makeSummary({ isPubliclyShared: true }));
    expect(shared.isPubliclyShared).toBe(true);
    const notShared = toLibraryItem(makeSummary({ isPubliclyShared: false }));
    expect(notShared.isPubliclyShared).toBe(false);
  });

  test("never leaks the publicShareId or shareSecretId to the library projection", () => {
    // Even when the underlying row carries identifiers (e.g. a
    // transcript that was previously shared), the summary
    // projection that the library list endpoint uses strips
    // everything down to `isPubliclyShared`. This keeps the
    // rotatable secret out of every "Load more" response.
    const row = makeSummary();
    const item = toLibraryItem(row);
    expect(item).not.toHaveProperty("publicShareId");
    expect(item).not.toHaveProperty("shareSecretId");
    expect(item).not.toHaveProperty("publicSharePath");
    expect(item).not.toHaveProperty("shareUpdatedAt");
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

  test("never leaks the raw customTitle (consumers read displayTitle)", () => {
    const row = makeSummary({ customTitle: "Alpha kickoff" });
    const item = toLibraryItem(row);
    expect(item).not.toHaveProperty("customTitle");
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
      customTitle: null,
      tags: [],
      isImportant: false,
      transcriptMarkdown: "# Transcript\n\nHello world.",
      recapMarkdown: "## Recap\n\n- Point one",
      sourceMediaKind: "audio",
      originalDurationSec: 1234.5,
      submittedWithNotes: true,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-02T11:00:00.000Z",
      completedAt: "2026-04-03T12:00:00.000Z",
      failure: null,
      share: {
        isPubliclyShared: false,
        publicSharePath: null,
        shareUpdatedAt: null,
      },
    });
  });

  test("exposes customTitle on the detail view so the rename control can pre-fill", () => {
    const row = makeRow({ customTitle: "Alpha kickoff" });
    const detail = toDetailView(row);
    expect(detail.customTitle).toBe("Alpha kickoff");
    expect(detail.displayTitle).toBe("Alpha kickoff");
  });

  test("exposes tags and isImportant", () => {
    const row = makeRow({ tags: ["urgent", "review"], isImportant: true });
    const detail = toDetailView(row);
    expect(detail.tags).toEqual(["urgent", "review"]);
    expect(detail.isImportant).toBe(true);
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

  test("emits a populated share block when the transcript is publicly shared", () => {
    const row = makeRow({
      isPubliclyShared: true,
      publicShareId: "11111111-1111-4111-8111-111111111111",
      shareSecretId: "22222222-2222-4222-8222-222222222222",
      shareUpdatedAt: new Date("2026-04-10T14:00:00.000Z"),
    });
    expect(toDetailView(row).share).toEqual({
      isPubliclyShared: true,
      publicSharePath: "/share/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222",
      shareUpdatedAt: "2026-04-10T14:00:00.000Z",
    });
  });

  test("never surfaces the publicSharePath when the share is disabled, even if identifiers survive on the row", () => {
    // Disabling preserves `publicShareId` so a future re-enable can
    // keep the same stable handle. The detail projection must
    // treat those identifiers as internal and emit a null path so
    // stale UI state cannot reconstruct a live URL from a
    // previously-enabled share.
    const row = makeRow({
      isPubliclyShared: false,
      publicShareId: "11111111-1111-4111-8111-111111111111",
      shareSecretId: null,
      shareUpdatedAt: new Date("2026-04-11T09:00:00.000Z"),
    });
    const detail = toDetailView(row);
    expect(detail.share.isPubliclyShared).toBe(false);
    expect(detail.share.publicSharePath).toBeNull();
    expect(detail.share.shareUpdatedAt).toBe("2026-04-11T09:00:00.000Z");
  });

  test("collapses shareUpdatedAt to null when it has never been touched", () => {
    const detail = toDetailView(makeRow());
    expect(detail.share).toEqual({
      isPubliclyShared: false,
      publicSharePath: null,
      shareUpdatedAt: null,
    });
  });

  test("does not leak the raw share identifiers to the detail projection", () => {
    // `publicShareId` and `shareSecretId` live only inside the
    // derived path. The projection never exposes them as bare
    // fields so clients cannot reconstruct a path of their own.
    const row = makeRow({
      isPubliclyShared: true,
      publicShareId: "11111111-1111-4111-8111-111111111111",
      shareSecretId: "22222222-2222-4222-8222-222222222222",
    });
    const detail = toDetailView(row);
    expect(detail).not.toHaveProperty("publicShareId");
    expect(detail).not.toHaveProperty("shareSecretId");
    expect(detail.share).not.toHaveProperty("publicShareId");
    expect(detail.share).not.toHaveProperty("shareSecretId");
  });
});

describe("buildSharePath", () => {
  test("renders the double-UUID path exactly as the public route parser expects", () => {
    expect(
      buildSharePath({
        publicShareId: "11111111-1111-4111-8111-111111111111",
        shareSecretId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe("/share/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222");
  });

  test("returns null when either identifier is missing so no half-populated path leaks", () => {
    // Callers should never receive a path like `/share/<id>/`
    // or `/share//<secret>` — either of those would hit the
    // public route with malformed segments and confuse the UUID
    // validator. The builder collapses both cases to null so the
    // caller explicitly decides how to handle the absent state.
    expect(buildSharePath({ publicShareId: null, shareSecretId: "22222222-2222-4222-8222-222222222222" })).toBeNull();
    expect(buildSharePath({ publicShareId: "11111111-1111-4111-8111-111111111111", shareSecretId: null })).toBeNull();
    expect(buildSharePath({ publicShareId: null, shareSecretId: null })).toBeNull();
  });
});
