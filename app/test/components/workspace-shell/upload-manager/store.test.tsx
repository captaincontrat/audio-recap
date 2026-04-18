import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { getUploadManagerStore, type RehydratedTranscriptStatus } from "@/components/workspace-shell/upload-manager/store";
import { UploadManagerTray } from "@/components/workspace-shell/upload-manager/tray";

import { DEFAULT_WORKSPACE, makeFile, makeUploadShellContext, renderInUploadShell, useFreshUploadManagerStore } from "./_helpers";

describe("UploadManagerStore workspace isolation (tasks 1.2, 1.3 / 7.3)", () => {
  useFreshUploadManagerStore();

  test("items added to one workspace do not appear in another", () => {
    const store = getUploadManagerStore();
    act(() => {
      store.addDraft({ workspaceSlug: "team-a", file: makeFile("a.mp3") });
      store.addDraft({ workspaceSlug: "team-b", file: makeFile("b.mp3") });
    });

    const teamA = store.getSnapshot("team-a");
    const teamB = store.getSnapshot("team-b");
    expect(teamA).toHaveLength(1);
    expect(teamA[0]?.fileName).toBe("a.mp3");
    expect(teamB).toHaveLength(1);
    expect(teamB[0]?.fileName).toBe("b.mp3");
  });

  test("tray mounted for slug-b never surfaces items added to slug-a (task 7.3)", () => {
    const store = getUploadManagerStore();
    act(() => {
      store.addDraft({ workspaceSlug: "team-a", file: makeFile("private-to-a.mp3") });
    });

    renderInUploadShell(<UploadManagerTray />, {
      context: makeUploadShellContext({
        workspace: { ...DEFAULT_WORKSPACE, slug: "team-b", name: "Team B" },
      }),
    });

    expect(screen.queryByText("private-to-a.mp3")).toBeNull();
    expect(screen.queryByTestId("workspace-shell-upload-manager")).toBeNull();
  });

  test("items survive intra-shell navigation that briefly unmounts the tray (task 1.3 / 7.3)", () => {
    const store = getUploadManagerStore();
    act(() => {
      store.addDraft({ workspaceSlug: "riley", file: makeFile("alive.mp3") });
    });

    const { unmount } = renderInUploadShell(<UploadManagerTray />);
    expect(screen.getByTestId("workspace-shell-upload-manager")).not.toBeNull();
    unmount();

    renderInUploadShell(<UploadManagerTray />);
    expect(screen.getByText("alive.mp3")).not.toBeNull();
  });
});

describe("UploadManagerStore rehydration merge (tasks 5.2, 5.3 / 7.4)", () => {
  useFreshUploadManagerStore();

  test("merges rehydrated transcript ids with in-session items, deduping by id", () => {
    const store = getUploadManagerStore();
    let inSessionId = "";
    act(() => {
      inSessionId = store.addDraft({ workspaceSlug: "riley", file: makeFile("a.mp3") });
      store.beginSubmission(inSessionId);
      store.attachTranscriptId(inSessionId, "tr_shared", "transcribing");
    });

    const rehydrated: RehydratedTranscriptStatus[] = [
      {
        id: "tr_shared",
        status: "generating_recap",
        title: "Q4 retro",
        failureSummary: null,
        sourceMediaKind: "audio",
        createdAt: new Date("2026-04-18T00:00:00Z").toISOString(),
        updatedAt: new Date("2026-04-18T00:01:00Z").toISOString(),
      },
      {
        id: "tr_new",
        status: "queued",
        title: null,
        failureSummary: null,
        sourceMediaKind: "audio",
        createdAt: new Date("2026-04-18T00:02:00Z").toISOString(),
        updatedAt: new Date("2026-04-18T00:02:00Z").toISOString(),
      },
    ];
    act(() => {
      store.mergeRehydrated("riley", rehydrated);
    });

    const items = store.getSnapshot("riley");
    expect(items).toHaveLength(2);
    const shared = items.find((item) => item.transcriptId === "tr_shared")!;
    expect(shared.serverPhase).toBe("generating_recap");
    expect(shared.title).toBe("Q4 retro");
    expect(shared.source).toBe("in_session");

    const fresh = items.find((item) => item.transcriptId === "tr_new")!;
    expect(fresh.source).toBe("rehydrated");
    expect(fresh.serverPhase).toBe("queued");
  });

  test("rehydration leaves drafts (no transcript id yet) untouched", () => {
    const store = getUploadManagerStore();
    let draftId = "";
    act(() => {
      draftId = store.addDraft({ workspaceSlug: "riley", file: makeFile("draft.mp3") });
    });

    act(() => {
      store.mergeRehydrated("riley", [
        {
          id: "tr_unrelated",
          status: "transcribing",
          title: null,
          failureSummary: null,
          sourceMediaKind: "audio",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    });

    const items = store.getSnapshot("riley");
    expect(items).toHaveLength(2);
    const draft = items.find((item) => item.id === draftId)!;
    expect(draft.localPhase).toBe("draft");
    expect(draft.transcriptId).toBeNull();
  });
});

describe("UploadManagerStore dismiss policy (task 4.3 / 7.2)", () => {
  useFreshUploadManagerStore();

  test("refuses to dismiss in-flight items", () => {
    const store = getUploadManagerStore();
    let id = "";
    act(() => {
      id = store.addDraft({ workspaceSlug: "riley", file: makeFile("a.mp3") });
      store.beginSubmission(id);
      store.setLocalPhase(id, "uploading");
    });

    act(() => {
      store.dismiss(id);
    });
    expect(store.getSnapshot("riley")).toHaveLength(1);
  });

  test("dismisses local-error items and terminal server-phase items", () => {
    const store = getUploadManagerStore();
    let failedLocalId = "";
    let completedId = "";
    let failedServerId = "";
    act(() => {
      failedLocalId = store.addDraft({ workspaceSlug: "riley", file: makeFile("a.mp3") });
      store.beginSubmission(failedLocalId);
      store.setLocalError(failedLocalId, "upload_failed", "Upload failed.");

      completedId = store.addDraft({ workspaceSlug: "riley", file: makeFile("b.mp3") });
      store.beginSubmission(completedId);
      store.attachTranscriptId(completedId, "tr_done", "completed");

      failedServerId = store.addDraft({ workspaceSlug: "riley", file: makeFile("c.mp3") });
      store.beginSubmission(failedServerId);
      store.attachTranscriptId(failedServerId, "tr_fail", "failed");
    });

    act(() => {
      store.dismiss(failedLocalId);
      store.dismiss(completedId);
      store.dismiss(failedServerId);
    });

    expect(store.getSnapshot("riley")).toHaveLength(0);
  });
});
