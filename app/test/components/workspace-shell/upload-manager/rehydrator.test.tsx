import { act } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { UploadManagerRehydrator } from "@/components/workspace-shell/upload-manager/rehydrator";
import { getUploadManagerStore, type RehydratedTranscriptStatus } from "@/components/workspace-shell/upload-manager/store";

import { renderInUploadShell, useFreshUploadManagerStore } from "./_helpers";

const { mockEnsurePolling } = vi.hoisted(() => ({
  mockEnsurePolling: vi.fn(),
}));

vi.mock("@/components/workspace-shell/upload-manager/polling", () => ({
  getUploadStatusPollingController: () => ({ ensurePolling: mockEnsurePolling, stopAll: vi.fn() }),
}));

describe("UploadManagerRehydrator (tasks 5.2, 5.3 / 7.4)", () => {
  useFreshUploadManagerStore();

  test("merges rehydrated rows into the store on mount", () => {
    const rehydrated: RehydratedTranscriptStatus[] = [
      {
        id: "tr_a",
        status: "transcribing",
        title: null,
        failureSummary: null,
        sourceMediaKind: "audio",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tr_b",
        status: "completed",
        title: "Q4 retro",
        failureSummary: null,
        sourceMediaKind: "audio",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    renderInUploadShell(<UploadManagerRehydrator rehydrated={rehydrated} />);

    const items = getUploadManagerStore().getSnapshot("riley");
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.transcriptId).sort()).toEqual(["tr_a", "tr_b"]);
  });

  test("starts polling for non-terminal rehydrated rows only (task 5.3 / 7.4)", () => {
    mockEnsurePolling.mockClear();
    const rehydrated: RehydratedTranscriptStatus[] = [
      {
        id: "tr_active",
        status: "transcribing",
        title: null,
        failureSummary: null,
        sourceMediaKind: "audio",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tr_done",
        status: "completed",
        title: "Q4 retro",
        failureSummary: null,
        sourceMediaKind: "audio",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tr_failed",
        status: "failed",
        title: null,
        failureSummary: "Upload failed",
        sourceMediaKind: "audio",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    renderInUploadShell(<UploadManagerRehydrator rehydrated={rehydrated} />);

    expect(mockEnsurePolling).toHaveBeenCalledTimes(1);
    expect(mockEnsurePolling).toHaveBeenCalledWith({ workspaceSlug: "riley", transcriptId: "tr_active" });
  });

  test("rendering with an empty list is a no-op", () => {
    renderInUploadShell(<UploadManagerRehydrator rehydrated={[]} />);
    expect(getUploadManagerStore().getSnapshot("riley")).toHaveLength(0);
  });

  test("does not duplicate items already present from a prior in-session submission (task 5.3 / 7.4)", () => {
    const store = getUploadManagerStore();
    let id = "";
    act(() => {
      id = store.addDraft({ workspaceSlug: "riley", file: new File(["x"], "x.mp3", { type: "audio/mpeg" }) });
      store.beginSubmission(id);
      store.attachTranscriptId(id, "tr_shared", "transcribing");
    });

    renderInUploadShell(
      <UploadManagerRehydrator
        rehydrated={[
          {
            id: "tr_shared",
            status: "generating_recap",
            title: "Q4 retro",
            failureSummary: null,
            sourceMediaKind: "audio",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    const items = store.getSnapshot("riley");
    expect(items).toHaveLength(1);
    expect(items[0]?.serverPhase).toBe("generating_recap");
    expect(items[0]?.title).toBe("Q4 retro");
  });
});
