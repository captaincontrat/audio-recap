import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { UploadDropOverlay } from "@/components/workspace-shell/upload-manager/drop-overlay";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";

import { DEFAULT_WORKSPACE, makeFile, makeUploadShellContext, renderInUploadShell, useFreshUploadManagerStore } from "./_helpers";

// jsdom's DragEvent does not let you set `dataTransfer` through the
// constructor, so we synthesize an Event with the dragenter/drop
// type and stamp `dataTransfer` on it directly. The overlay only
// reads `event.dataTransfer.types` and `event.dataTransfer.files`,
// which we mock with the minimum surface required.
function dispatchDragEvent(type: "dragenter" | "dragover" | "dragleave" | "drop", files: File[]): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  };
  for (let i = 0; i < files.length; i += 1) {
    (fileList as unknown as Record<number, File>)[i] = files[i]!;
  }
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: {
      types: ["Files"],
      files: fileList,
      dropEffect: "none",
      effectAllowed: "all",
    },
  });
  window.dispatchEvent(event);
}

describe("UploadDropOverlay (tasks 2.1, 2.4 / 7.1, 7.5)", () => {
  useFreshUploadManagerStore();

  test("does not render before any drag is active", () => {
    renderInUploadShell(<UploadDropOverlay />);
    expect(screen.queryByTestId("workspace-shell-upload-drop-overlay")).toBeNull();
  });

  test("activates on dragenter with files and shows the workspace name", () => {
    renderInUploadShell(<UploadDropOverlay />);
    act(() => {
      dispatchDragEvent("dragenter", [makeFile("a.mp3")]);
    });
    const overlay = screen.getByTestId("workspace-shell-upload-drop-overlay");
    expect(overlay.textContent).toMatch(new RegExp(DEFAULT_WORKSPACE.name));
  });

  test("dropping a file adds a draft to the store and dismisses the overlay", () => {
    renderInUploadShell(<UploadDropOverlay />);
    const file = makeFile("kickoff.mp3");
    act(() => {
      dispatchDragEvent("dragenter", [file]);
      dispatchDragEvent("drop", [file]);
    });

    const items = getUploadManagerStore().getSnapshot("riley");
    expect(items).toHaveLength(1);
    expect(items[0]?.fileName).toBe("kickoff.mp3");
    expect(items[0]?.localPhase).toBe("draft");
    expect(screen.queryByTestId("workspace-shell-upload-drop-overlay")).toBeNull();
  });

  test("does not register listeners when canSubmit is false (task 2.4 / 7.5)", () => {
    renderInUploadShell(<UploadDropOverlay />, {
      context: makeUploadShellContext({
        workspace: { ...DEFAULT_WORKSPACE, archivedAt: new Date("2026-01-01").toISOString() },
      }),
      canSubmit: false,
    });

    act(() => {
      dispatchDragEvent("dragenter", [makeFile("a.mp3")]);
      dispatchDragEvent("drop", [makeFile("a.mp3")]);
    });

    expect(screen.queryByTestId("workspace-shell-upload-drop-overlay")).toBeNull();
    expect(getUploadManagerStore().getSnapshot("riley")).toHaveLength(0);
  });
});
