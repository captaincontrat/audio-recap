import { normalizeMediaForSubmission } from "./media-normalization";

// Browser-side submission orchestration. Keeps the page component thin
// by centralizing the multi-step flow:
//   1. Detect audio vs video, run the normalization abstraction.
//   2. Call the server `prepare` route with submission metadata +
//      normalization outcome.
//   3. Upload the media (and optional notes) to the returned presigned
//      PUT descriptors.
//   4. Call the server `finalize` route to create the durable transcript
//      row and enqueue the worker.
//
// Errors raised here are either `MeetingSubmissionError` instances (with
// a user-renderable message) or unexpected failures that callers should
// display as generic errors.

const MAX_MEDIA_BYTES = 2000 * 1024 * 1024; // 2GB
const MAX_NOTES_BYTES = 64 * 1024;

export type PreparePresignedPut = {
  key: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
  expiresInSec: number;
};

export type PrepareResponse = {
  ok: true;
  planToken: string;
  expiresInSec: number;
  uploads: {
    media: PreparePresignedPut;
    notes: PreparePresignedPut | null;
  };
  submission: {
    uploadId: string;
    resolvedMediaInputKind: "original" | "mp3-derivative";
    mediaNormalizationPolicySnapshot: "optional" | "required";
  };
};

export type FinalizeResponse = {
  ok: true;
  transcript: { id: string; status: string };
};

export type ErrorResponse = {
  ok: false;
  code: string;
  message: string;
};

export class MeetingSubmissionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MeetingSubmissionError";
    this.code = code;
  }
}

// Optional progress callbacks the upload manager wires up so the tray
// can show "normalizing", "preparing", "uploading", or "finalizing"
// as the helper walks through each step, and so the conversion
// progress stream from Mediabunny can drive a determinate progress
// bar on long-running encodes. The dedicated meeting form wires the
// same callbacks so it can render the same explicit local phases
// instead of a single opaque "Submitting…" state.
export type SubmissionPhaseCallbacks = {
  onNormalizing?: () => void;
  onNormalizationProgress?: (progress: number) => void;
  onPreparing?: () => void;
  onUploading?: () => void;
  onFinalizing?: () => void;
};

export type SubmitMeetingInputs = {
  workspaceSlug: string;
  file: File;
  notesText?: string;
  callbacks?: SubmissionPhaseCallbacks;
  // Optional caller-controlled abort. When the signal fires before
  // upload starts, the in-flight Mediabunny conversion is cancelled
  // (freeing its encoder Worker) and `submitMeeting()` rejects with
  // an `AbortError`-shaped `DOMException`. Callers (the dedicated
  // form, the upload-manager runner) treat that as a deliberate
  // cancel rather than a submission failure.
  signal?: AbortSignal;
};

export type SubmitMeetingResult = {
  transcriptId: string;
  submission: PrepareResponse["submission"];
};

export async function submitMeeting(inputs: SubmitMeetingInputs): Promise<SubmitMeetingResult> {
  if (inputs.file.size <= 0) {
    throw new MeetingSubmissionError("empty_file", "The selected file is empty.");
  }
  if (inputs.file.size > MAX_MEDIA_BYTES) {
    throw new MeetingSubmissionError("media_too_large", "This file is larger than the 500 MB per-submission limit.");
  }

  const notes = inputs.notesText?.trim();
  if (notes && new Blob([notes]).size > MAX_NOTES_BYTES) {
    throw new MeetingSubmissionError("notes_too_long", "Meeting notes exceed the 64 KB limit.");
  }

  const mediaKind = deriveMediaKind(inputs.file);
  if (!mediaKind) {
    throw new MeetingSubmissionError("media_unsupported", "Only audio or video files are supported.");
  }

  if (inputs.signal?.aborted) {
    throw new DOMException("Submission cancelled", "AbortError");
  }

  inputs.callbacks?.onNormalizing?.();

  const normalization = await normalizeMediaForSubmission({
    file: inputs.file,
    kind: mediaKind,
    ...(inputs.signal ? { signal: inputs.signal } : {}),
    ...(inputs.callbacks?.onNormalizationProgress ? { onProgress: inputs.callbacks.onNormalizationProgress } : {}),
  });
  const uploadFile = normalization.file;
  const uploadContentType = uploadFile.type || inputs.file.type;

  if (inputs.signal?.aborted) {
    throw new DOMException("Submission cancelled", "AbortError");
  }

  inputs.callbacks?.onPreparing?.();

  const prepare = await postJson<PrepareResponse>(`/api/workspaces/${encodeURIComponent(inputs.workspaceSlug)}/meetings/prepare`, {
    sourceMediaKind: mediaKind,
    mediaBytes: uploadFile.size,
    mediaContentType: uploadContentType,
    mediaFilename: inputs.file.name,
    ...(notes ? { notesText: notes } : {}),
    normalization: normalization.outcome,
  });

  inputs.callbacks?.onUploading?.();

  await uploadToPresignedUrl(prepare.uploads.media, uploadFile);
  if (prepare.uploads.notes && notes) {
    const notesBlob = new Blob([notes], {
      type: "text/markdown; charset=utf-8",
    });
    await uploadToPresignedUrl(prepare.uploads.notes, notesBlob);
  }

  inputs.callbacks?.onFinalizing?.();

  const finalize = await postJson<FinalizeResponse>(`/api/workspaces/${encodeURIComponent(inputs.workspaceSlug)}/meetings`, {
    planToken: prepare.planToken,
  });

  return {
    transcriptId: finalize.transcript.id,
    submission: prepare.submission,
  };
}

function deriveMediaKind(file: File): "audio" | "video" | null {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  const lower = file.name.toLowerCase();
  if (/\.(mp3|wav|m4a|aac|flac|ogg|oga|opus|webm)$/.test(lower)) return "audio";
  if (/\.(mp4|mov|webm|mkv|m4v|avi)$/.test(lower)) return "video";
  return null;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    ok: boolean;
    code?: string;
    message?: string;
  } | null;
  if (!payload || typeof payload !== "object") {
    throw new MeetingSubmissionError("unexpected_response", "Unexpected response from the server.");
  }
  if (payload.ok === false) {
    throw new MeetingSubmissionError(payload.code ?? "unknown_error", payload.message ?? "Unexpected error from the server.");
  }
  return payload as unknown as T;
}

async function uploadToPresignedUrl(descriptor: PreparePresignedPut, body: Blob): Promise<void> {
  const response = await fetch(descriptor.url, {
    method: descriptor.method,
    headers: descriptor.headers,
    body,
  });
  if (!response.ok) {
    throw new MeetingSubmissionError("upload_failed", `Upload to transient storage failed with status ${response.status}.`);
  }
}
