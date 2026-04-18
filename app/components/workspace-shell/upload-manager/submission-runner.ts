"use client";

// Per-item submission orchestration. Drives the local phases of one
// upload-manager item by walking `submitMeeting()` and updating the
// store as each callback fires. On success the runner attaches the
// transcript id and hands the item off to the polling controller; on
// failure it pins the local error so the user can review the cause
// from the tray and dismiss the row.
//
// The runner is a plain async function — not a hook — so kicking off
// a submission does not require a React tree to keep ticking. The
// store and the polling controller are module-level singletons, so
// the work survives intra-shell navigation that briefly unmounts the
// tray.

import { MeetingSubmissionError, submitMeeting, type SubmitMeetingResult } from "@/lib/client/meeting-submission";

import { describeSubmissionErrorCode } from "./error-messages";
import { getUploadStatusPollingController } from "./polling";
import type { UploadManagerItem, UploadManagerStore } from "./store";

export type RunSubmissionDeps = {
  // Tests inject a stub `submitMeeting` so they can advance phase
  // callbacks deterministically.
  submitMeetingFn?: typeof submitMeeting;
  // Optional copy override for the message stored on `local_error`.
  // The dedicated form passes this so it can keep its policy-aware
  // wording for `normalization_required_failed` while every other
  // shell entry point keeps the shared, policy-agnostic copy.
  errorMessageOverride?: (code: string, fallback: string) => string | null;
};

// Result returned to callers that want to react to the outcome (the
// dedicated form needs the transcript id for its redirect; the tray
// drives everything off the store and ignores the result).
export type RunSubmissionResult =
  | { kind: "submitted"; transcriptId: string }
  | { kind: "rejected"; reason: "not_a_draft" | "missing_file" }
  | { kind: "failed"; code: string; message: string };

// Run the upload pipeline for one draft item. Caller is expected to
// have already validated that the item is in the `draft` phase — the
// runner immediately transitions it to `preparing` and refuses to run
// against any other shape.
export async function runSubmissionForDraft(store: UploadManagerStore, item: UploadManagerItem, deps: RunSubmissionDeps = {}): Promise<RunSubmissionResult> {
  if (!item.file) {
    const message = resolveErrorMessage("media_missing", "Media file missing.", deps.errorMessageOverride);
    store.setLocalError(item.id, "media_missing", message);
    return { kind: "rejected", reason: "missing_file" };
  }
  const beginResult = store.beginSubmission(item.id);
  if (!beginResult) {
    return { kind: "rejected", reason: "not_a_draft" };
  }
  const submit = deps.submitMeetingFn ?? submitMeeting;
  try {
    const result: SubmitMeetingResult = await submit({
      workspaceSlug: item.workspaceSlug,
      file: item.file,
      ...(item.notes.trim().length > 0 ? { notesText: item.notes } : {}),
      callbacks: {
        onPreparing: () => store.setLocalPhase(item.id, "preparing"),
        onUploading: () => store.setLocalPhase(item.id, "uploading"),
        onFinalizing: () => store.setLocalPhase(item.id, "finalizing"),
      },
    });
    store.attachTranscriptId(item.id, result.transcriptId, "queued");
    getUploadStatusPollingController(store).ensurePolling({
      workspaceSlug: item.workspaceSlug,
      transcriptId: result.transcriptId,
    });
    return { kind: "submitted", transcriptId: result.transcriptId };
  } catch (error) {
    if (error instanceof MeetingSubmissionError) {
      const message = resolveErrorMessage(error.code, error.message, deps.errorMessageOverride);
      store.setLocalError(item.id, error.code, message);
      return { kind: "failed", code: error.code, message };
    }
    const message = "Something went wrong submitting your meeting. Please try again.";
    store.setLocalError(item.id, "unexpected_error", message);
    return { kind: "failed", code: "unexpected_error", message };
  }
}

function resolveErrorMessage(code: string, fallback: string, override: RunSubmissionDeps["errorMessageOverride"]): string {
  const overridden = override?.(code, fallback);
  if (overridden) return overridden;
  return describeSubmissionErrorCode(code, fallback);
}
