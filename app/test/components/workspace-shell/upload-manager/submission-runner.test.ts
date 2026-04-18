import { describe, expect, test, vi, afterEach, beforeEach } from "vitest";

import { MeetingSubmissionError, type SubmitMeetingResult } from "@/lib/client/meeting-submission";
import { runSubmissionForDraft } from "@/components/workspace-shell/upload-manager/submission-runner";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";

const { mockEnsurePolling } = vi.hoisted(() => ({
  mockEnsurePolling: vi.fn(),
}));

vi.mock("@/components/workspace-shell/upload-manager/polling", () => ({
  getUploadStatusPollingController: () => ({ ensurePolling: mockEnsurePolling, stopAll: vi.fn() }),
}));

function makeFile(name = "x.mp3"): File {
  return new File(["bytes"], name, { type: "audio/mpeg" });
}

beforeEach(() => {
  getUploadManagerStore().__resetForTests();
  mockEnsurePolling.mockClear();
});

afterEach(() => {
  getUploadManagerStore().__resetForTests();
});

describe("runSubmissionForDraft (tasks 3.3, 5.1 / 7.1)", () => {
  test("walks the draft through preparing → uploading → finalizing → server queued", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    const item = store.findItem(id)!;
    const phaseLog: string[] = [];
    const submitMeetingFn = vi.fn(async (input: { callbacks?: { onPreparing?: () => void; onUploading?: () => void; onFinalizing?: () => void } }) => {
      input.callbacks?.onPreparing?.();
      phaseLog.push(store.findItem(id)?.localPhase ?? "?");
      input.callbacks?.onUploading?.();
      phaseLog.push(store.findItem(id)?.localPhase ?? "?");
      input.callbacks?.onFinalizing?.();
      phaseLog.push(store.findItem(id)?.localPhase ?? "?");
      return {
        transcriptId: "tr_done",
        submission: { uploadId: "u1", resolvedMediaInputKind: "original", mediaNormalizationPolicySnapshot: "optional" },
      } satisfies SubmitMeetingResult;
    });

    const result = await runSubmissionForDraft(store, item, { submitMeetingFn });
    expect(result.kind).toBe("submitted");
    if (result.kind === "submitted") {
      expect(result.transcriptId).toBe("tr_done");
    }
    expect(phaseLog).toEqual(["preparing", "uploading", "finalizing"]);
    const final = store.findItem(id)!;
    expect(final.serverPhase).toBe("queued");
    expect(final.transcriptId).toBe("tr_done");
    expect(mockEnsurePolling).toHaveBeenCalledWith({ workspaceSlug: "riley", transcriptId: "tr_done" });
  });

  test("rejects items that are not in draft phase", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    store.beginSubmission(id);
    const item = store.findItem(id)!;
    const submitMeetingFn = vi.fn();
    const result = await runSubmissionForDraft(store, item, { submitMeetingFn });
    expect(result).toEqual({ kind: "rejected", reason: "not_a_draft" });
    expect(submitMeetingFn).not.toHaveBeenCalled();
  });

  test("captures MeetingSubmissionError and pins a local-error row", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    const item = store.findItem(id)!;
    const submitMeetingFn = vi.fn(async () => {
      throw new MeetingSubmissionError("upload_failed", "Upload to transient storage failed.");
    });
    const result = await runSubmissionForDraft(store, item, { submitMeetingFn });
    expect(result).toEqual({
      kind: "failed",
      code: "upload_failed",
      message: "Upload to transient storage failed. Please retry in a moment.",
    });
    const final = store.findItem(id)!;
    expect(final.localPhase).toBe("local_error");
    expect(final.errorCode).toBe("upload_failed");
  });

  test("error message override (used by the dedicated form) takes priority over the shared mapping", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    const item = store.findItem(id)!;
    const submitMeetingFn = vi.fn(async () => {
      throw new MeetingSubmissionError("normalization_required_failed", "Browser normalization unavailable.");
    });
    const result = await runSubmissionForDraft(store, item, {
      submitMeetingFn,
      errorMessageOverride: (code, fallback) => (code === "normalization_required_failed" ? "Try Chrome or Edge." : fallback),
    });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.message).toBe("Try Chrome or Edge.");
    }
    expect(store.findItem(id)?.errorMessage).toBe("Try Chrome or Edge.");
  });

  test("treats unexpected errors as a generic failure", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    const item = store.findItem(id)!;
    const submitMeetingFn = vi.fn(async () => {
      throw new Error("network blew up");
    });
    const result = await runSubmissionForDraft(store, item, { submitMeetingFn });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.code).toBe("unexpected_error");
    }
  });
});
