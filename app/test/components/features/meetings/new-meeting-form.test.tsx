import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { NewMeetingForm } from "@/components/features/meetings/new-meeting-form";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";

import { DEFAULT_WORKSPACE, makeFile, makeUploadShellContext, renderInUploadShell } from "../../workspace-shell/upload-manager/_helpers";

// Mocks are hoisted so they replace the real modules before the
// component imports them. The dedicated form is the only entry
// point in the shell that redirects on success — every other entry
// point keeps the user on the current route — so its post-submit
// behavior is its own regression surface.
const { pushMock, runSubmissionMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  runSubmissionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock("@/components/workspace-shell/upload-manager/submission-runner", () => ({
  runSubmissionForDraft: runSubmissionMock,
}));

beforeEach(() => {
  pushMock.mockReset();
  runSubmissionMock.mockReset();
  getUploadManagerStore().__resetForTests();
});

afterEach(() => {
  getUploadManagerStore().__resetForTests();
});

function fillForm(file: File): void {
  const input = screen.getByLabelText(/Meeting audio or video/) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("NewMeetingForm (dedicated submission page)", () => {
  test("redirects to the dedicated meeting status page once the runner reports success", async () => {
    runSubmissionMock.mockResolvedValueOnce({ kind: "submitted", transcriptId: "trx_redirect" });
    renderInUploadShell(<NewMeetingForm normalizationPolicy="optional" />);

    fillForm(makeFile("kickoff.mp3"));
    fireEvent.click(screen.getByRole("button", { name: /Submit for processing/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/w/riley/meetings/trx_redirect");
    expect(screen.getByText(/Submission accepted\. Redirecting…/)).not.toBeNull();
  });

  test("encodes the workspace slug and transcript id so reserved characters survive in the URL", async () => {
    runSubmissionMock.mockResolvedValueOnce({ kind: "submitted", transcriptId: "trx with space" });
    renderInUploadShell(<NewMeetingForm normalizationPolicy="optional" />, {
      context: makeUploadShellContext({
        workspace: { ...DEFAULT_WORKSPACE, slug: "riley team" },
      }),
    });

    fillForm(makeFile("kickoff.mp3"));
    fireEvent.click(screen.getByRole("button", { name: /Submit for processing/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/w/riley%20team/meetings/trx%20with%20space");
  });

  test("does not redirect when the runner reports a failure and surfaces the error message under the form", async () => {
    runSubmissionMock.mockResolvedValueOnce({
      kind: "failed",
      code: "upload_failed",
      message: "Upload to transient storage failed. Please retry in a moment.",
    });
    renderInUploadShell(<NewMeetingForm normalizationPolicy="optional" />);

    fillForm(makeFile("kickoff.mp3"));
    fireEvent.click(screen.getByRole("button", { name: /Submit for processing/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Upload to transient storage failed.");
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Submit for processing/ }).hasAttribute("disabled")).toBe(false);
  });

  test("does not redirect when the runner rejects the draft and surfaces the staging fallback", async () => {
    runSubmissionMock.mockResolvedValueOnce({ kind: "rejected", reason: "not_a_draft" });
    renderInUploadShell(<NewMeetingForm normalizationPolicy="optional" />);

    fillForm(makeFile("kickoff.mp3"));
    fireEvent.click(screen.getByRole("button", { name: /Submit for processing/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not stage the upload. Please retry.");
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("forwards the policy-aware error override to the runner so the dedicated form keeps its tailored copy", async () => {
    runSubmissionMock.mockResolvedValueOnce({ kind: "submitted", transcriptId: "trx_after_override" });
    renderInUploadShell(<NewMeetingForm normalizationPolicy="required" />);

    fillForm(makeFile("kickoff.mp3"));
    fireEvent.click(screen.getByRole("button", { name: /Submit for processing/ }));

    await waitFor(() => expect(runSubmissionMock).toHaveBeenCalledTimes(1));
    const callArgs = runSubmissionMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    const opts = callArgs![2] as { errorMessageOverride?: (code: string, fallback: string) => string | null };
    expect(typeof opts.errorMessageOverride).toBe("function");
    const overridden = opts.errorMessageOverride!("normalization_required_failed", "fallback");
    expect(overridden).toBe(
      "This workspace requires browser-side MP3 conversion, which is not available in your browser. Try Chrome or Edge, or ask an admin to relax the policy.",
    );
    const passthrough = opts.errorMessageOverride!("upload_failed", "fallback for upload failure");
    expect(passthrough).toBe("fallback for upload failure");
  });

  test("creates a draft in the upload manager store before invoking the runner so the tray reflects in-flight work", async () => {
    runSubmissionMock.mockImplementationOnce(async () => {
      const items = getUploadManagerStore().getSnapshot("riley");
      expect(items).toHaveLength(1);
      expect(items[0]?.fileName).toBe("kickoff.mp3");
      expect(items[0]?.notes).toBe("Attendees: Riley, Jordan");
      return { kind: "submitted", transcriptId: "trx_after_draft" };
    });
    renderInUploadShell(<NewMeetingForm normalizationPolicy="optional" />);

    fillForm(makeFile("kickoff.mp3"));
    fireEvent.change(screen.getByLabelText(/Meeting notes \(optional\)/), {
      target: { value: "Attendees: Riley, Jordan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit for processing/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/w/riley/meetings/trx_after_draft"));
    expect(runSubmissionMock).toHaveBeenCalledTimes(1);
  });
});
