// Browser-side media normalization to MP3, backed by Mediabunny
// (https://mediabunny.dev) plus the LAME-backed `@mediabunny/mp3-encoder`
// extension. Mediabunny was chosen over `@ffmpeg/ffmpeg` for being
// web-native, materially lighter, and avoiding the COOP/COEP
// cross-origin-isolation requirement that would have clashed with the
// project's existing Google One Tap auth flow. The full vendor
// decision and the per-step pipeline reference live in
// `openspec/changes/add-mediabunny-browser-normalization/design.md`.
//
// The exported outcome shape is the same three-state union the server
// already speaks (`succeeded` / `unavailable` / `failed`), so the
// prepare endpoint, the policy enforcement, and the upload manager
// keep working without coordinated downstream changes. User-initiated
// cancellation is intentionally NOT a fourth outcome — when the
// caller's `AbortSignal` fires we throw an `AbortError`-shaped
// `DOMException` so `submitMeeting()` and the upload-manager runner
// can treat it as deliberate cancel control flow rather than as a
// failed submission.

import { registerMp3Encoder } from "@mediabunny/mp3-encoder";
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, ConversionCanceledError, canEncodeAudio, Input, Mp3OutputFormat, Output } from "mediabunny";

// Speech-focused encoding profile. A fixed low bitrate plus mono output
// is materially smaller than the library's default `QUALITY_HIGH`
// transcode target while remaining sufficient for meeting
// transcription/summarization.
const MP3_TARGET_BITRATE = 64_000;
const MP3_TARGET_CHANNELS = 1;
const MP3_TARGET_SAMPLE_RATE = 32_000;

export type MediaNormalizationSource = {
  file: File;
  kind: "audio" | "video";
  // Optional caller-controlled abort. When the signal fires, the
  // in-flight conversion is cancelled, the encoder Worker is freed,
  // and this function throws an `AbortError`-shaped `DOMException`
  // instead of returning a `failed` outcome. Callers (the dedicated
  // form, the upload-manager runner) treat that as a local cancel
  // path rather than a submission failure.
  signal?: AbortSignal;
  // Optional progress hook wired into Mediabunny's
  // `Conversion.onProgress`. Receives a number in `[0, 1]`. Used by
  // the dedicated submission form and the upload-manager tray to
  // surface conversion progress on long-running encodes instead of a
  // static spinner.
  onProgress?: (progress: number) => void;
};

// Outcome sent to the server. Matches `BrowserNormalizationOutcome` in
// the server-side meetings module so this value can be forwarded
// verbatim to the prepare endpoint.
export type ClientNormalizationOutcome = { kind: "succeeded"; inputKind: "mp3-derivative" } | { kind: "unavailable" } | { kind: "failed" };

export type MediaNormalizationResult = {
  outcome: ClientNormalizationOutcome;
  // File to upload to transient storage. When the outcome is
  // `succeeded`, this is the produced MP3 derivative; otherwise, it
  // is the caller's original file (still uploaded so the worker can
  // fall through to the original-input pipeline in `optional` policy
  // mode).
  file: File;
};

export async function normalizeMediaForSubmission(source: MediaNormalizationSource): Promise<MediaNormalizationResult> {
  if (source.signal?.aborted) {
    throw makeAbortError();
  }

  // The environment probe replaces the previous SharedArrayBuffer
  // heuristic. Mediabunny relies on standard Web Workers and the
  // WebCodecs decoder/encoder surface (presence of `AudioDecoder`
  // proves the runtime ships WebCodecs at all; Mediabunny then
  // negotiates per-codec encodability via `canEncodeAudio` below).
  // Browsers without WebCodecs (notably some older Safari versions)
  // fail this probe and short-circuit to `unavailable`, matching the
  // contract the spec already documents for unsupported browsers.
  if (!hasMediabunnyPrerequisites()) {
    return { outcome: { kind: "unavailable" }, file: source.file };
  }

  // Lazy-register the LAME-backed MP3 encoder polyfill the first time
  // we discover the browser cannot natively encode MP3. Registration
  // is a global side-effect; gating on `canEncodeAudio` keeps the
  // bundle path lighter on browsers that gain native support later.
  if (!(await canEncodeAudio("mp3"))) {
    registerMp3Encoder();
  }

  const input = new Input({
    source: new BlobSource(source.file),
    formats: ALL_FORMATS,
  });

  const output = new Output({
    format: new Mp3OutputFormat(),
    target: new BufferTarget(),
  });

  let conversion: Conversion;
  try {
    conversion = await Conversion.init({
      input,
      output,
      audio: {
        bitrate: MP3_TARGET_BITRATE,
        numberOfChannels: MP3_TARGET_CHANNELS,
        sampleRate: MP3_TARGET_SAMPLE_RATE,
      },
    });
  } catch {
    if (source.signal?.aborted) {
      throw makeAbortError();
    }
    return { outcome: { kind: "failed" }, file: source.file };
  }

  // `Mp3OutputFormat` accepts only audio tracks by definition, so any
  // video tracks in `kind: "video"` selections are automatically
  // discarded by the converter — no per-`kind` branch is needed
  // beyond the telemetry hint already passed in `source.kind`.
  if (!conversion.isValid) {
    return { outcome: { kind: "unavailable" }, file: source.file };
  }

  if (source.onProgress) {
    conversion.onProgress = source.onProgress;
  }

  const onAbort = (): void => {
    void conversion.cancel().catch(() => {});
  };
  source.signal?.addEventListener("abort", onAbort, { once: true });

  // Late-binding race: the signal could have flipped to aborted in the
  // microtask gap between the probe at the top of the function and the
  // listener registration above. Re-check here so we always invoke
  // `cancel()` for an already-aborted signal rather than waiting for an
  // event that will never fire.
  if (source.signal?.aborted) {
    void conversion.cancel().catch(() => {});
  }

  try {
    await conversion.execute();
  } catch (error) {
    if (error instanceof ConversionCanceledError) {
      throw makeAbortError();
    }
    return { outcome: { kind: "failed" }, file: source.file };
  } finally {
    if (source.signal) {
      source.signal.removeEventListener("abort", onAbort);
    }
  }

  const buffer = output.target.buffer;
  if (!buffer) {
    // Defensive: `execute()` resolved without producing bytes. Treat
    // as a real conversion failure so the upload falls back to the
    // original file under `optional` policy mode.
    return { outcome: { kind: "failed" }, file: source.file };
  }

  const mp3 = new File([buffer], `${baseName(source.file.name)}.mp3`, { type: "audio/mpeg" });
  return { outcome: { kind: "succeeded", inputKind: "mp3-derivative" }, file: mp3 };
}

function hasMediabunnyPrerequisites(): boolean {
  if (typeof globalThis === "undefined") return false;
  const env = globalThis as { Worker?: unknown; AudioDecoder?: unknown };
  return typeof env.Worker === "function" && typeof env.AudioDecoder === "function";
}

function baseName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

function makeAbortError(): DOMException {
  return new DOMException("Normalization cancelled", "AbortError");
}
