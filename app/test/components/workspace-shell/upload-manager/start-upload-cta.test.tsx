import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { OverviewStartUploadCta } from "@/components/workspace-shell/upload-manager/start-upload-cta";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";

import { DEFAULT_WORKSPACE, makeFile, makeUploadShellContext, renderInUploadShell, useFreshUploadManagerStore } from "./_helpers";

describe("OverviewStartUploadCta (task 6.2 / 7.6)", () => {
  useFreshUploadManagerStore();

  test("renders the default test id and is enabled when canSubmit is true", () => {
    renderInUploadShell(<OverviewStartUploadCta />);
    const button = screen.getByTestId("overview-start-upload-cta");
    expect(button.tagName).toBe("BUTTON");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  test("supports an alternative test id for the empty-state CTA", () => {
    renderInUploadShell(<OverviewStartUploadCta testId="overview-empty-start-upload-cta" />);
    expect(screen.getByTestId("overview-empty-start-upload-cta")).not.toBeNull();
    expect(screen.getByTestId("overview-empty-start-upload-cta-input")).not.toBeNull();
  });

  test("does not navigate to the dedicated submission page; selecting a file adds a draft (task 6.2 / 7.6)", () => {
    renderInUploadShell(<OverviewStartUploadCta />);
    const button = screen.getByTestId("overview-start-upload-cta");
    expect(button.getAttribute("href")).toBeNull();

    const input = screen.getByTestId("overview-start-upload-cta-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("kickoff.mp3")] } });

    const items = getUploadManagerStore().getSnapshot("riley");
    expect(items).toHaveLength(1);
    expect(items[0]?.fileName).toBe("kickoff.mp3");
    expect(items[0]?.localPhase).toBe("draft");
  });

  test("renders inert when the workspace is archived (task 7.5)", () => {
    renderInUploadShell(<OverviewStartUploadCta />, {
      context: makeUploadShellContext({
        workspace: { ...DEFAULT_WORKSPACE, archivedAt: new Date("2026-01-01").toISOString() },
      }),
      canSubmit: false,
    });
    expect(screen.getByTestId("overview-start-upload-cta").hasAttribute("disabled")).toBe(true);
  });
});
