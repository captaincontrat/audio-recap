// Browser-side media normalization abstraction. The server sees the
// outcome through the same shape defined by
// `BrowserNormalizationOutcome` in `@/lib/server/meetings`, so this
// module is the single place the web runtime decides between
// "succeeded" (MP3 derivative produced), "unavailable" (browser cannot
// run the conversion), and "failed" (attempt threw an error).
//
// The actual MP3 conversion requires a substantial dependency
// (`@ffmpeg/ffmpeg`), COOP/COEP headers, and SharedArrayBuffer support.
// For the first iteration we advertise the outcome shape through a
// placeholder that always reports `unavailable` so the rest of the
// pipeline (policy gating, rejection UX, upload handoff) exercises the
// real contract. Dropping a working ffmpeg.wasm implementation in later
// only needs to replace this one function.

export type MediaNormalizationSource = {
  file: File;
  kind: "audio" | "video";
};

// Outcome sent to the server. Matches
// `BrowserNormalizationOutcome` in the server-side meetings module so
// this value can be forwarded verbatim to the prepare endpoint.
export type ClientNormalizationOutcome = { kind: "succeeded"; inputKind: "mp3-derivative" } | { kind: "unavailable" } | { kind: "failed" };

export type MediaNormalizationResult = {
  outcome: ClientNormalizationOutcome;
  // File to upload to transient storage. When the outcome is
  // `succeeded`, this is the produced MP3 derivative; otherwise, it is
  // the caller's original file (still uploaded so the worker can fall
  // through to the original-input pipeline in `optional` policy mode).
  file: File;
};

export async function normalizeMediaForSubmission(source: MediaNormalizationSource): Promise<MediaNormalizationResult> {
  // Runtime feature probe — keep cheap so the submission flow can call
  // this unconditionally. When the necessary browser APIs are missing,
  // report "unavailable" so `required` policy mode rejects the
  // submission and `optional` mode falls through to the original file.
  if (!hasSharedArrayBufferSupport()) {
    return { outcome: { kind: "unavailable" }, file: source.file };
  }

  // Placeholder: actual `@ffmpeg/ffmpeg` integration goes here. Until
  // then, we behave as if conversion is not yet implemented so the
  // server sees the policy-handling path without needing the heavy
  // wasm payload.
  return { outcome: { kind: "unavailable" }, file: source.file };
}

function hasSharedArrayBufferSupport(): boolean {
  if (typeof globalThis === "undefined") return false;
  return typeof (globalThis as { SharedArrayBuffer?: unknown }).SharedArrayBuffer === "function";
}
