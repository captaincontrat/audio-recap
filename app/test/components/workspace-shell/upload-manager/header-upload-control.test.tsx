import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { UploadHeaderControl } from "@/components/workspace-shell/upload-manager/header-upload-control";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";

import { DEFAULT_WORKSPACE, makeFile, makeUploadShellContext, renderInUploadShell, useFreshUploadManagerStore } from "./_helpers";

describe("UploadHeaderControl (tasks 2.2, 2.4 / 7.1, 7.5)", () => {
  useFreshUploadManagerStore();

  test("renders an enabled upload trigger when the viewer can submit", () => {
    renderInUploadShell(<UploadHeaderControl />);
    const button = screen.getByTestId("workspace-shell-upload-header-control");
    expect(button.tagName).toBe("BUTTON");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("data-can-submit")).toBe("true");
  });

  test("renders disabled when the workspace is archived (task 2.4 / 7.5)", () => {
    renderInUploadShell(<UploadHeaderControl />, {
      context: makeUploadShellContext({
        workspace: { ...DEFAULT_WORKSPACE, archivedAt: new Date("2026-01-01").toISOString() },
      }),
      canSubmit: false,
    });
    const button = screen.getByTestId("workspace-shell-upload-header-control");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("data-can-submit")).toBe("false");
  });

  test("renders disabled when the viewer is read-only (task 2.4 / 7.5)", () => {
    renderInUploadShell(<UploadHeaderControl />, {
      context: makeUploadShellContext({ currentRole: "read_only" }),
      canSubmit: false,
    });
    expect(screen.getByTestId("workspace-shell-upload-header-control").hasAttribute("disabled")).toBe(true);
  });

  test("file selection adds drafts to the upload manager store (task 2.2 / 7.1)", () => {
    renderInUploadShell(<UploadHeaderControl />);
    const input = screen.getByTestId("workspace-shell-upload-header-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("kickoff.mp3"), makeFile("review.mp3")] } });

    const items = getUploadManagerStore().getSnapshot("riley");
    expect(items).toHaveLength(2);
    expect(items[0]?.fileName).toBe("kickoff.mp3");
    expect(items[1]?.fileName).toBe("review.mp3");
    expect(items.every((item) => item.localPhase === "draft")).toBe(true);
  });
});
