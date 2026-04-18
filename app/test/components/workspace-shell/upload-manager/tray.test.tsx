import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, test, vi } from "vitest";

import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";
import { UploadManagerTray } from "@/components/workspace-shell/upload-manager/tray";

import { makeFile, renderInUploadShell, useFreshUploadManagerStore } from "./_helpers";

const { mockRunSubmissionForDraft } = vi.hoisted(() => {
  type RunArgs = [unknown, { id: string; notes: string }, ...unknown[]];
  type RunResult = { kind: "submitted"; transcriptId: string };
  const fn = vi.fn<(...args: RunArgs) => Promise<RunResult>>().mockResolvedValue({
    kind: "submitted",
    transcriptId: "tr_test",
  });
  return { mockRunSubmissionForDraft: fn };
});

vi.mock("@/components/workspace-shell/upload-manager/submission-runner", () => ({
  runSubmissionForDraft: mockRunSubmissionForDraft,
}));

describe("UploadManagerTray (tasks 4.x / 7.1, 7.2)", () => {
  useFreshUploadManagerStore();

  test("renders nothing when the workspace has no items", () => {
    renderInUploadShell(<UploadManagerTray />);
    expect(screen.queryByTestId("workspace-shell-upload-manager")).toBeNull();
  });

  test("draft card renders file metadata, notes input, and confirm/cancel actions", () => {
    const store = getUploadManagerStore();
    act(() => {
      store.addDraft({ workspaceSlug: "riley", file: makeFile("kickoff.mp3") });
    });

    renderInUploadShell(<UploadManagerTray />);

    const card = screen.getByTestId("workspace-shell-upload-item");
    expect(card.getAttribute("data-phase")).toBe("draft");
    expect(within(card).getByText("kickoff.mp3")).not.toBeNull();
    const notesInput = within(card).getByLabelText(/notes/i);
    expect(notesInput).not.toBeNull();
    expect(within(card).getByTestId("workspace-shell-upload-item-confirm")).not.toBeNull();
    expect(within(card).getByTestId("workspace-shell-upload-item-cancel")).not.toBeNull();
  });

  test("cancel discards the draft without calling the submission runner (task 3.2 / 7.1)", () => {
    const store = getUploadManagerStore();
    act(() => {
      store.addDraft({ workspaceSlug: "riley", file: makeFile("kickoff.mp3") });
    });

    renderInUploadShell(<UploadManagerTray />);

    fireEvent.click(screen.getByTestId("workspace-shell-upload-item-cancel"));

    expect(screen.queryByTestId("workspace-shell-upload-manager")).toBeNull();
    expect(mockRunSubmissionForDraft).not.toHaveBeenCalled();
  });

  test("confirm runs submitMeeting orchestration (task 3.3 / 7.1)", async () => {
    const store = getUploadManagerStore();
    let draftId = "";
    act(() => {
      draftId = store.addDraft({ workspaceSlug: "riley", file: makeFile("kickoff.mp3") });
      store.updateDraftNotes(draftId, "Decisions and follow-ups");
    });

    renderInUploadShell(<UploadManagerTray />);

    fireEvent.click(screen.getByTestId("workspace-shell-upload-item-confirm"));

    await waitFor(() => {
      expect(mockRunSubmissionForDraft).toHaveBeenCalledTimes(1);
    });
    const call = mockRunSubmissionForDraft.mock.calls[0]!;
    const passedItem = call[1];
    expect(passedItem.id).toBe(draftId);
    expect(passedItem.notes).toBe("Decisions and follow-ups");
  });

  test("supports concurrent items, renders one card per item (task 4.2 / 7.2)", () => {
    const store = getUploadManagerStore();
    act(() => {
      store.addDraft({ workspaceSlug: "riley", file: makeFile("a.mp3") });
      store.addDraft({ workspaceSlug: "riley", file: makeFile("b.mp3") });
      store.addDraft({ workspaceSlug: "riley", file: makeFile("c.mp3") });
    });

    renderInUploadShell(<UploadManagerTray />);

    expect(screen.getAllByTestId("workspace-shell-upload-item")).toHaveLength(3);
    expect(screen.getByTestId("workspace-shell-upload-manager-count").textContent).toBe("3");
  });

  test("collapses to summary header when the queue exceeds the threshold (task 4.2 / 7.2)", () => {
    const store = getUploadManagerStore();
    act(() => {
      for (let i = 0; i < 5; i++) {
        store.addDraft({ workspaceSlug: "riley", file: makeFile(`file-${i}.mp3`) });
      }
    });

    renderInUploadShell(<UploadManagerTray />);

    expect(screen.getByTestId("workspace-shell-upload-manager-count").textContent).toBe("5");
    // Collapsible content is rendered with `data-state="closed"`
    // and visually hidden when collapsed; we read that attribute to
    // decide whether the tray is currently expanded.
    const list = screen.getByTestId("workspace-shell-upload-manager-list");
    expect(list.getAttribute("data-state")).toBe("closed");

    fireEvent.click(screen.getByTestId("workspace-shell-upload-manager-toggle"));
    expect(list.getAttribute("data-state")).toBe("open");
    expect(screen.getAllByTestId("workspace-shell-upload-item")).toHaveLength(5);
  });

  test("dismiss removes terminal items but is not offered for in-flight rows (task 4.3 / 7.2)", () => {
    const store = getUploadManagerStore();
    let inFlightId = "";
    let completedId = "";
    act(() => {
      inFlightId = store.addDraft({ workspaceSlug: "riley", file: makeFile("a.mp3") });
      completedId = store.addDraft({ workspaceSlug: "riley", file: makeFile("b.mp3") });
      store.beginSubmission(inFlightId);
      store.setLocalPhase(inFlightId, "uploading");
      store.beginSubmission(completedId);
      store.attachTranscriptId(completedId, "tr_completed", "completed");
    });

    renderInUploadShell(<UploadManagerTray />);

    const cards = screen.getAllByTestId("workspace-shell-upload-item");
    const inFlightCard = cards.find((card) => card.getAttribute("data-item-id") === inFlightId)!;
    const completedCard = cards.find((card) => card.getAttribute("data-item-id") === completedId)!;
    expect(within(inFlightCard).queryByTestId("workspace-shell-upload-item-dismiss")).toBeNull();
    const dismissBtn = within(completedCard).getByTestId("workspace-shell-upload-item-dismiss");

    fireEvent.click(dismissBtn);

    expect(screen.queryByText("b.mp3")).toBeNull();
    expect(screen.getAllByTestId("workspace-shell-upload-item")).toHaveLength(1);
  });

  test("failed (local error) items remain in the tray until dismissed (task 4.3 / 7.2)", () => {
    const store = getUploadManagerStore();
    let id = "";
    act(() => {
      id = store.addDraft({ workspaceSlug: "riley", file: makeFile("oops.mp3") });
      store.beginSubmission(id);
      store.setLocalError(id, "upload_failed", "Upload to transient storage failed.");
    });

    renderInUploadShell(<UploadManagerTray />);

    const card = screen.getByTestId("workspace-shell-upload-item");
    expect(card.getAttribute("data-phase")).toBe("local_error");
    expect(screen.getByText(/Upload to transient storage failed/)).not.toBeNull();
    expect(within(card).getByTestId("workspace-shell-upload-item-dismiss")).not.toBeNull();
  });

  test("server-phase rows link to the dedicated transcript status page (task 4.4 / 7.2)", () => {
    const store = getUploadManagerStore();
    act(() => {
      const id = store.addDraft({ workspaceSlug: "riley", file: makeFile("a.mp3") });
      store.beginSubmission(id);
      store.attachTranscriptId(id, "tr_abc123", "transcribing");
    });

    renderInUploadShell(<UploadManagerTray />);

    const link = screen.getByTestId("workspace-shell-upload-item-link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/w/riley/meetings/tr_abc123");
  });
});
