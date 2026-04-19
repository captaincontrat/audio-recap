import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getUploadManagerStore } from "@/components/workspace-shell/upload-manager/store";
import { runSubmissionForDraft } from "@/components/workspace-shell/upload-manager/submission-runner";
import { MeetingSubmissionError, type SubmissionPhaseCallbacks, type SubmitMeetingResult } from "@/lib/client/meeting-submission";

const { mockEnsurePolling } = vi.hoisted(() => ({
  mockEnsurePolling: vi.fn(),
}));

vi.mock("@/components/workspace-shell/upload-manager/polling", () => ({
  getUploadStatusPollingController: () => ({ ensurePolling: mockEnsurePolling, stopAll: vi.fn() }),
}));

type SubmitInput = {
  signal?: AbortSignal;
  callbacks?: SubmissionPhaseCallbacks;
};

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

describe("runSubmissionForDraft (tasks 3.3, 5.2 / 5.3 / 7.1)", () => {
  test("walks the draft through normalizing → preparing → uploading → finalizing → server queued", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    const item = store.findItem(id)!;
    const phaseLog: string[] = [];
    const submitMeetingFn = vi.fn(async (input: SubmitInput) => {
      input.callbacks?.onNormalizing?.();
      phaseLog.push(store.findItem(id)?.localPhase ?? "?");
      input.callbacks?.onPreparing?.();
      phaseLog.push(store.findItem(id)?.localPhase ?? "?");
      input.callbacks?.onUploading?.();
      phaseLog.push(store.findItem(id)?.localPhase ?? "?");
      input.callbacks?.onFinalizing?.();
      phaseLog.push(store.findItem(id)?.localPhase ?? "?");
      return {
        transcriptId: "tr_done",
        submission: { uploadId: "u1", resolvedMediaInputKind: "mp3-derivative", mediaNormalizationPolicySnapshot: "optional" },
      } satisfies SubmitMeetingResult;
    });

    const result = await runSubmissionForDraft(store, item, { submitMeetingFn });
    expect(result.kind).toBe("submitted");
    if (result.kind === "submitted") {
      expect(result.transcriptId).toBe("tr_done");
    }
    expect(phaseLog).toEqual(["normalizing", "preparing", "uploading", "finalizing"]);
    const final = store.findItem(id)!;
    expect(final.serverPhase).toBe("queued");
    expect(final.transcriptId).toBe("tr_done");
    expect(mockEnsurePolling).toHaveBeenCalledWith({ workspaceSlug: "riley", transcriptId: "tr_done" });
  });

  test("registers an AbortController so cancel UI anywhere in the shell can stop the in-flight submission", async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    const item = store.findItem(id)!;
    // Capture the signal through an object property so TS can see
    // the closure write across the await boundary (a `let foo:
    // AbortSignal | null` would narrow back to `null` post-await).
    const captured: { signal: AbortSignal | null } = { signal: null };
    const submitMeetingFn = vi.fn(async (input: SubmitInput) => {
      captured.signal = input.signal ?? null;
      input.callbacks?.onNormalizing?.();
      return {
        transcriptId: "tr_after_signal_check",
        submission: { uploadId: "u1", resolvedMediaInputKind: "mp3-derivative", mediaNormalizationPolicySnapshot: "optional" },
      } satisfies SubmitMeetingResult;
    });

    await runSubmissionForDraft(store, item, { submitMeetingFn });

    expect(captured.signal).not.toBeNull();
    expect(captured.signal?.aborted).toBe(false);
  });

  test('user cancel during normalizing aborts cleanly, removes the item from the store, and returns kind: "cancelled"', async () => {
    const store = getUploadManagerStore();
    const id = store.addDraft({ workspaceSlug: "riley", file: makeFile() });
    const item = store.findItem(id)!;
    const captured: { signal: AbortSignal | null } = { signal: null };
    const submitMeetingFn = vi.fn(async (input: SubmitInput) => {
      captured.signal = input.signal ?? null;
      input.callbacks?.onNormalizing?.();
      // Wait indefinitely; the only way out is the abort signal that
      // `cancelInFlight` triggers below.
      return new Promise<SubmitMeetingResult>((_, reject) => {
        input.signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
      });
    });

    const runPromise = runSubmissionForDraft(store, item, { submitMeetingFn });
    // Yield once so the runner reaches `submitMeetingFn` and the
    // controller is registered in the store before we cancel.
    await Promise.resolve();

    store.cancelInFlight(id);
    const result = await runPromise;

    expect(result).toEqual({ kind: "cancelled" });
    expect(captured.signal?.aborted).toBe(true);
    expect(store.findItem(id)).toBeNull();
    expect(mockEnsurePolling).not.toHaveBeenCalled();
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
