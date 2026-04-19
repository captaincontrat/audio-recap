## Context

`meeting-import-processing` already requires the submission flow to perform browser-side MP3 normalization before upload handoff. The contract surface — `ClientNormalizationOutcome` (`succeeded` / `unavailable` / `failed`), the database-backed `mediaNormalizationPolicy` (`optional` by default, can be flipped to `required`), the prepare endpoint, the policy snapshot stored on each accepted job, and the upload-manager's policy-aware error mapping — is all in place and exercised by tests today.

What is missing is the actual implementation behind `normalizeMediaForSubmission()` in `app/lib/client/media-normalization.ts`. The function is a placeholder that always returns `{ kind: "unavailable" }`, so every submission today silently falls through to the `optional`-policy fallback path and uploads the original file. The placeholder code's own comment even still references `@ffmpeg/ffmpeg` as the eventual vendor, even though that option was explicitly weighed against and rejected during scoping in favor of Mediabunny. The vendor name was preserved in `openspec/split-audit/add-web-meeting-processing-original/` but lost from the active design when the original change was split.

The downstream worker contract is already live and complete. `app/worker/processors/meetings.ts` calls `processMeetingForWorker` from `audio-recap`, which routes both `mediaInputKind: "mp3-derivative"` (Mediabunny output) and `mediaInputKind: "original"` (raw upload) through the shared `prepareAudioForUpload` → `transcribePreparedAudio` → `generateMeetingSummary` → `generateMeetingTitle` pipeline. Once the browser starts producing real MP3 derivatives, the MP3-derivative branch — which exists but has not been exercised by real submissions — finally gets exercised end-to-end.

## Goals / Non-Goals

**Goals:**

- Replace the placeholder `normalizeMediaForSubmission()` with a real Mediabunny-backed implementation that produces an MP3 derivative on browsers that support it, for both `kind: "audio"` (convert to MP3) and `kind: "video"` (extract primary audio, then encode to MP3) selections.
- Re-anchor the Mediabunny vendor decision in this change's `design.md` with current rationale and the package names used (`mediabunny` + `@mediabunny/mp3-encoder`).
- Keep the existing `ClientNormalizationOutcome` and `MediaNormalizationResult` shapes unchanged so the prepare endpoint, the upload manager, the policy enforcement, and the existing tests keep working without coordinated downstream changes.
- Keep the database-backed `mediaNormalizationPolicy` default at `optional` so browsers that cannot run Mediabunny continue to upload the original validated file as the active spec already permits.
- Keep the submission UI responsive while conversion runs by relying on Mediabunny's encoder worker for the heavy lifting, surfacing a truthful local `normalizing` phase with visible progress, and exposing a clean user-initiated cancellation path before upload starts.

**Non-Goals:**

- Changing the worker pipeline. `processMeetingForWorker` already accepts MP3-derivative inputs; this change simply starts producing them.
- Flipping the default `mediaNormalizationPolicy` from `optional` to `required`. That can be a follow-up change once telemetry shows Mediabunny succeeds reliably across the user base. The existing `required` mode keeps working — it just becomes meaningfully exercisable for the first time.
- Changing the existing `ClientNormalizationOutcome` shape, the prepare endpoint, or the database-backed normalization policy.
- Changing the server-side transcript-processing lifecycle vocabulary (`queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, `failed`).
- Optimizing or refactoring the worker-side MP3 handling (e.g., skipping the worker's ffmpeg re-encode when the input is already an MP3). Keep the worker's pipeline shape stable here.
- Naming the vendor in the active spec. The vendor stays in this design document so we can swap it later without a requirement-level delta.
- Server-side validation that uploaded MP3s match what Mediabunny is supposed to produce (same upload limits and validation paths as today; the worker will reject anything unprocessable as it does today).

## Decisions

### Decision: Use Mediabunny (`mediabunny`) plus the LAME-backed MP3 encoder (`@mediabunny/mp3-encoder`) for browser-side normalization

The browser-side normalization library for this change is [Mediabunny](https://mediabunny.dev/), with the [`Mp3OutputFormat`](https://mediabunny.dev/guide/output-formats#mp3) configured via the [Conversion API](https://mediabunny.dev/guide/quick-start#convert-files). Because most browsers do not natively support MP3 encoding through WebCodecs, the implementation also installs the official [`@mediabunny/mp3-encoder`](https://mediabunny.dev/guide/extensions/mp3-encoder) extension, which ships a SIMD-enabled WASM build of LAME inside its own Web Worker.

The implementation registers the encoder lazily, only when the browser does not already advertise native MP3 encoding support:

```ts
import { canEncodeAudio } from "mediabunny";
import { registerMp3Encoder } from "@mediabunny/mp3-encoder";

if (!(await canEncodeAudio("mp3"))) {
  registerMp3Encoder();
}
```

This keeps the bundle path lighter on browsers that gain native support later, and makes the dependency on LAME explicit only on the path that actually needs it.

**Why this over alternatives**

- **Over `@ffmpeg/ffmpeg`** (the rejected alternative still namechecked in the placeholder comment): a multi-thread `ffmpeg.wasm` build needs `SharedArrayBuffer`, which in turn needs the page to send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. Those headers break embedded third-party resources, including the Google One Tap auth flow already chosen by the bootstrap change. Mediabunny relies on WebCodecs and standard Workers, so it does not require COOP/COEP cross-origin isolation and does not conflict with One Tap. Mediabunny is also materially lighter on the wire (≈30 kB minified+gzipped for "Reading all formats", ≈70 kB for "All features", per the Mediabunny landing page) than a full ffmpeg.wasm bundle, and benchmarks roughly an order of magnitude faster for the operations we care about.
- **Over native `MediaRecorder`**: `MediaRecorder` does not produce MP3 output reliably across browsers (typical outputs are WebM/Opus or MP4/AAC), and it is a stream-recording API rather than a transcoder. We would still need a separate path to convert pre-recorded files.
- **Over deferring browser-side normalization to a follow-up**: the policy machinery, prepare endpoint, upload manager, and worker MP3-derivative branch are all already built and tested for the no-op placeholder. Continuing to ship that placeholder means the end-to-end pipeline the product was designed around — privacy-minimizing client-side conversion before upload — never actually runs. This is the cheapest moment to land the real implementation.

### Decision: Use Mediabunny's high-level `Conversion` API with one shared `Mp3OutputFormat` for both audio and video selections

Both `kind: "audio"` and `kind: "video"` selections funnel through the same conversion shape:

```ts
import { Input, Output, ALL_FORMATS, BlobSource, BufferTarget, Mp3OutputFormat, Conversion } from "mediabunny";

const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
const output = new Output({ format: new Mp3OutputFormat(), target: new BufferTarget() });
const conversion = await Conversion.init({ input, output });

if (!conversion.isValid) {
  return { outcome: { kind: "unavailable" }, file };
}

await conversion.execute();
const mp3 = new File([output.target.buffer!], `${baseName(file.name)}.mp3`, { type: "audio/mpeg" });
return { outcome: { kind: "succeeded", inputKind: "mp3-derivative" }, file: mp3 };
```

For video inputs, `Mp3OutputFormat` accepts no video tracks by definition, so Mediabunny's Conversion API automatically discards the video track and extracts the primary audio track for encoding. This means we do not need a branch for "audio file" vs "video file" beyond using the `kind` hint for telemetry / error messages.

**Why this over alternatives**

- **Over hand-rolling the demux + decode + encode chain via Mediabunny's lower-level sinks**: the Conversion API already orchestrates demux → decode → encode and exposes `isValid`, `discardedTracks`, and `onProgress` hooks. Hand-rolling that pipeline would duplicate logic Mediabunny already maintains and is well-tested.
- **Over branching by `kind`**: a single conversion shape is shorter, has one failure surface, and matches Mediabunny's own design where the output format dictates which input tracks survive.
- **Over reusing the input file's basename verbatim**: appending `.mp3` to the basename gives the upload a sensible filename for logs and S3 object keys without leaking the user's original codec/container in the new content type.

### Decision: Map Mediabunny outcomes onto the existing three-state `ClientNormalizationOutcome` shape

The `normalizeMediaForSubmission()` contract already returns a tagged union with `succeeded` / `unavailable` / `failed`. The actual conversion outcomes in the Mediabunny implementation map onto it as follows:

| Mediabunny situation | Outcome | File returned |
| --- | --- | --- |
| Browser environment lacks the prerequisites we need (no WebCodecs, no `Worker`, etc.) | `{ kind: "unavailable" }` | original file |
| `Conversion.init()` returns `conversion.isValid === false` (no decodable track of the kind we need) | `{ kind: "unavailable" }` | original file |
| `conversion.execute()` resolves successfully | `{ kind: "succeeded", inputKind: "mp3-derivative" }` | new MP3 `File` |
| `conversion.execute()` throws during a real conversion attempt (decoder error, codec missing, OOM, etc.) | `{ kind: "failed" }` | original file |

User-initiated cancellation is intentionally **not** a fourth normalization outcome. When the caller aborts before upload starts, `normalizeMediaForSubmission()` calls `conversion.cancel()` and then aborts the local submission path (for example by rejecting with an abort-shaped error) instead of returning `{ kind: "failed" }`. `submitMeeting()` and the upload-manager runner treat that as a deliberate cancel: no `prepare` request, no uploaded file, and no red failed state in the UI. This keeps the server-facing normalization shape stable while matching user intent.

This is the same shape the prepare endpoint and the policy enforcement already speak. No server-side downstream changes are needed.

**Why this over alternatives**

- **Over adding new outcome variants** like `succeeded-with-warnings` or per-error-cause failure codes: the existing three states already drive the policy decision (`optional` accepts any non-`succeeded` outcome; `required` rejects any non-`succeeded` outcome). Richer outcomes would force coordinated changes across server and UI without changing user-visible behavior.
- **Over throwing on `conversion.isValid === false`**: that case (e.g., a corrupt file or an unsupported codec) is exactly what `unavailable` is for in the active spec — the browser cannot perform the conversion, so the policy decides what happens next.
- **Over surfacing user-initiated cancellation as `failed`**: a deliberate cancel is control flow, not an error. Turning it into a failure would leave behind misleading red UI and push users toward retrying something they intentionally stopped.

### Decision: Run conversion on the main thread, expose it as a dedicated `normalizing` local phase with required progress and pre-upload cancellation, and rely on Mediabunny's internal Worker for heavy work

The MP3 encoder package spawns its own Web Worker for the LAME WASM encoding step, so the CPU-heavy work is already off the main thread without any Worker setup on our side. Demuxing and decoding via WebCodecs likewise execute on browser-managed background threads.

The implementation runs the high-level `Conversion` orchestration on the main thread, but it does **not** hide that work inside a vague `preparing` label. The dedicated submission form and the shared upload manager expose a separate local `normalizing` phase before the short post-conversion `prepare` request. `conversion.onProgress` is wired into both surfaces so long conversions show visible movement when the runtime emits determinate progress; before the first progress tick, the UI still shows a truthful "Converting to MP3…" in-progress state rather than a static generic preparation message.

User-initiated cancellation is available until upload starts. Aborting during `normalizing` (or the brief post-conversion `preparing` step) stops the local submission attempt and returns the surface to a non-error state; it does not pin a `local_error` row or a failure message. This gives users a clean escape hatch during the one part of the submission flow that may now be long-running locally.

The submission UI stays interactive while conversion runs, satisfying the new "submission UI stays responsive" scenario in the spec delta.

**Why this over alternatives**

- **Over running the entire orchestration in a dedicated Web Worker we own**: that would duplicate the worker structure Mediabunny's encoder package already manages, and would force us to build a `postMessage`-based protocol around `MediaNormalizationResult` for marginal benefit. The encoding hot path is already offloaded.
- **Over reusing the existing `preparing` phase**: long-running browser conversion hidden behind "Preparing…" reads like a hung request and obscures the one pre-upload phase the user most needs explained.
- **Over making progress optional**: once conversion becomes materially visible on large files, visible movement is part of the product contract, not a nice-to-have.
- **Over no cancellation hook**: large video files can take material time to decode; without a cancellation path, the user would have no way to stop work that has not even reached upload yet.
- **Over surfacing canceled work as failed**: a successful cancel should feel like "stopped" or "dismissed", not like the product broke.

### Decision: Keep required-policy messaging truthful for both unsupported and attempted-but-failed normalization

The placeholder-era copy for `normalization_required_failed` was written in a world where browser-side normalization never actually ran. Once Mediabunny lands, the same user-visible rejection can arise because the browser cannot run the conversion **or** because the browser tried and the conversion failed on that file. The dedicated form and the upload manager therefore need copy that stays truthful in both cases: generic messaging should say the required browser-side MP3 conversion did not succeed, and more specific messaging may distinguish "your browser cannot do this conversion" from "this conversion attempt failed" when the client knows which path occurred.

**Why this over alternatives**

- **Over keeping the old "conversion did not run" wording**: that becomes false on exactly the supported browsers we most expect to use, which erodes trust the first time a real conversion attempt fails.
- **Over adding new server refusal codes just for copy**: the client already knows enough context locally to keep the messaging honest, so the server contract does not need extra UX-only variants.

### Decision: Use `BufferTarget` for the produced MP3, capped by the existing `SUBMISSION_MAX_MEDIA_BYTES` ceiling

The implementation writes the MP3 into an in-memory `BufferTarget` (Mediabunny's default for produced files) and wraps the resulting `ArrayBuffer` in a `File` for handoff to the upload manager. The existing `SUBMISSION_MAX_MEDIA_BYTES` server-side ceiling and the documented "MP3, WAV, M4A, MP4, MOV, and similar formats are supported up to 500 MB" copy on the dedicated submission form already bound the input. Even at the input ceiling, an MP3 derivative encoded at typical voice bitrates (≈32–64 kbps mono for meeting audio) sits well under the input ceiling and within commodity browser memory budgets.

**Why this over alternatives**

- **Over `StreamTarget`**: streaming the produced MP3 directly into the presigned `PUT` upload would shave a memory copy, but it requires additional plumbing (a `TransformStream` plus signed-URL upload integration) and would not change the user-visible contract. The simpler `BufferTarget` path is fine for the input ceilings we already enforce; we can revisit if we ever raise the ceiling materially.
- **Over also raising or lowering the existing 500 MB submission ceiling here**: changing intake limits is a separate user-visible product decision and does not belong in a Mediabunny adoption change.

### Decision: Default `mediaNormalizationPolicy` stays `optional`

`DEFAULT_MEDIA_NORMALIZATION_POLICY` in `app/lib/server/meetings/normalization-policy.ts` stays `"optional"` for fresh installs. The behavior change users will see after this change ships is that on supported browsers Mediabunny actually produces an MP3 derivative (instead of the placeholder always reporting `unavailable`), so on those browsers the upload becomes the MP3 and the worker takes the MP3-derivative branch. On unsupported browsers, the original file is uploaded exactly as it is today.

**Why this over alternatives**

- **Over flipping the default to `required`**: doing both the implementation and the policy flip in one change creates two coupled risks (the implementation might have rough edges across browsers, AND a regression there now blocks every submission on non-Mediabunny browsers). Splitting into two changes lets us land Mediabunny first, observe behavior, then make a deliberate, separately-reasoned decision about whether the default should tighten.
- **Over a follow-up change that flips the default immediately on land**: there is no telemetry in this change for cross-browser success rates. The right time to flip the default is when we have evidence that the conversion succeeds reliably on the browser mix we actually serve.

### Decision: Keep the vendor name out of the spec; capture it in this design only

The active `meeting-import-processing` spec describes browser-side normalization in vendor-agnostic terms ("browser SHALL try to convert", `succeeded` / `unavailable` / `failed`). This change preserves that posture and adds the vendor name only here in `design.md`. The two new spec scenarios introduced by this change ("Browser-side normalization is genuinely attempted on supported browsers"; "Submission UI stays responsive while normalization runs") are also vendor-agnostic and would be satisfied by any future implementation we swap in.

**Why this over alternatives**

- **Over naming `Mediabunny` in the spec requirement text**: that would create a requirement-level vendor lock-in, where swapping the library later (e.g., for native browser MP3 encoding once support broadens, or for a competitor) would require a spec delta even though no user-visible behavior changes.
- **Over capturing the vendor only in code comments**: code comments tend to drift (the existing placeholder still mentions the rejected option, `@ffmpeg/ffmpeg`). Anchoring the choice in this design document keeps the rationale durably linked to the change that introduced it.

## How Mediabunny normalizes any media file to MP3

This section is a self-contained reference for whoever implements task 2.1. The decisions above explain *why* Mediabunny is the chosen vendor; this section explains *how* the canonical Mediabunny pipeline turns any supported input file into an MP3 derivative, with deep links into the official Mediabunny documentation for each step. The reference is built from the [Mediabunny llms-full.txt corpus](https://mediabunny.dev/llms-full.txt) (the source of truth for the API) and the corresponding HTML guide pages.

### What "any media file" actually covers

Mediabunny ships built-in demuxers for every commonly used media container, all wired up via the `ALL_FORMATS` constant exported from the `mediabunny` package:

- ISOBMFF-based formats: `.mp4`, `.m4v`, `.m4a`
- QuickTime File Format: `.mov`
- Matroska: `.mkv`
- WebM: `.webm`
- Ogg: `.ogg`
- MP3: `.mp3`
- WAVE: `.wav`
- ADTS: `.aac`
- FLAC: `.flac`
- MPEG Transport Stream: `.ts`

See [Supported formats & codecs > Container formats](https://mediabunny.dev/guide/supported-formats-and-codecs#container-formats) for the canonical list and [Input formats > Input format singletons](https://mediabunny.dev/guide/input-formats#input-format-singletons) for the per-format singletons. Files whose container is outside this set (or whose audio track uses a codec the browser cannot decode) fall through `Conversion.init()` with `isValid === false`, which we map to `unavailable` per [the outcome table above](#decision-map-mediabunny-outcomes-onto-the-existing-three-state-clientnormalizationoutcome-shape).

### End-to-end pipeline

The seven-step pipeline below is the implementation sketch for `normalizeMediaForSubmission()`. Each step links to the relevant Mediabunny doc page so the implementer can drill in.

```ts
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp3OutputFormat,
  Output,
} from "mediabunny";
import { registerMp3Encoder } from "@mediabunny/mp3-encoder";

// 1. Lazy-register the LAME-backed MP3 encoder polyfill the first time we
//    discover the browser's WebCodecs implementation cannot natively encode
//    MP3. The encoder is a worker-resident, SIMD-enabled WASM build of LAME
//    3.100 and is bundled into the extension package — no CDN, no separate
//    WASM path argument needed.
//    Docs: https://mediabunny.dev/guide/extensions/mp3-encoder
//    Docs: https://mediabunny.dev/guide/supported-formats-and-codecs#querying-codec-encodability
if (!(await canEncodeAudio("mp3"))) {
  registerMp3Encoder();
}

// 2. Wrap the user-selected `File` in a `BlobSource` and create an `Input`
//    with `ALL_FORMATS` so any of the supported containers above is
//    accepted. `BlobSource` reads the file lazily, so even multi-hundred-MB
//    inputs do not have to be fully buffered into memory before decoding.
//    Docs: https://mediabunny.dev/guide/reading-media-files#input-sources
//    Docs: https://mediabunny.dev/guide/input-formats
const input = new Input({
  source: new BlobSource(source.file),
  formats: ALL_FORMATS,
});

// 3. Build an `Output` whose container format is MP3 and whose target keeps
//    the produced bytes in memory. `BufferTarget` is the right default for
//    files bounded by our existing `SUBMISSION_MAX_MEDIA_BYTES` ceiling;
//    see the `BufferTarget` decision above for when to revisit this.
//    Docs: https://mediabunny.dev/guide/output-formats#mp3
//    Docs: https://mediabunny.dev/guide/writing-media-files#buffertarget
const output = new Output({
  format: new Mp3OutputFormat(),
  target: new BufferTarget(),
});

// 4. Initialize the conversion. `Mp3OutputFormat` accepts only audio tracks
//    by definition, so any video tracks in the input are automatically
//    discarded by the converter — `kind: "video"` selections do not need a
//    separate code path beyond the telemetry hint we already pass in.
//    Docs: https://mediabunny.dev/guide/converting-media-files#basic-usage
const conversion = await Conversion.init({ input, output });

// 5. If the conversion is invalid (no decodable audio track, unknown source
//    codec, no encodable MP3 target available even after the polyfill, ...),
//    bail out with `unavailable`. `discardedTracks` is a structured reason
//    list (`unknown_source_codec`, `undecodable_source_codec`,
//    `no_encodable_target_codec`, ...) that is useful for client-side logs.
//    Docs: https://mediabunny.dev/guide/converting-media-files#discarded-tracks
if (!conversion.isValid) {
  return { outcome: { kind: "unavailable" }, file: source.file };
}

// 6. Wire conversion progress into the dedicated form and the upload manager's
//    explicit `normalizing` phase so long video inputs show visible movement.
//    Docs: https://mediabunny.dev/guide/converting-media-files#monitoring-progress
conversion.onProgress = (progress) => {
  // progress: number in [0, 1]; emitted as the conversion advances.
  source.onProgress?.(progress);
};

// 7. Allow the caller to abort an in-flight conversion before upload starts.
//    `cancel()` frees the encoder Worker and rejects the in-flight
//    `execute()` with `ConversionCanceledError`. User-initiated cancellation
//    is treated as local submission control flow, not a failed normalization
//    attempt, so we rethrow an abort-shaped error instead of returning
//    `{ kind: "failed" }`.
//    Docs: https://mediabunny.dev/guide/converting-media-files#canceling-a-conversion
source.signal?.addEventListener(
  "abort",
  () => {
    void conversion.cancel();
  },
  { once: true },
);

try {
  await conversion.execute();
} catch (error) {
  if (error instanceof ConversionCanceledError && source.signal?.aborted) {
    throw new DOMException("Normalization cancelled", "AbortError");
  }
  return { outcome: { kind: "failed" }, file: source.file };
}

// 8. `BufferTarget.buffer` is now the produced MP3 as an `ArrayBuffer`.
//    Wrap it in a `File` with the right MIME type and a `.mp3` filename so
//    the upload payload, S3 object key, and worker logs all read cleanly.
const mp3 = new File(
  [output.target.buffer!],
  `${baseName(source.file.name)}.mp3`,
  { type: "audio/mpeg" },
);
return { outcome: { kind: "succeeded", inputKind: "mp3-derivative" }, file: mp3 };
```

### Optional: tune the conversion for meeting voice

The worker re-encodes every upload to mono / 16 kHz / 48 kbps via `prepareAudioForUpload` in `libs/audio-recap/src/audio/ffmpeg.ts` regardless of what shape the browser delivers. To shrink the upload itself (helpful on slow connections) and reduce the in-memory `BufferTarget` footprint, the conversion can be aligned with the worker's downstream target by passing audio options to `Conversion.init`:

```ts
const conversion = await Conversion.init({
  input,
  output,
  audio: {
    numberOfChannels: 1, // downmix multi-channel meeting audio to mono
    sampleRate: 16000,   // matches the worker's `-ar 16000`
    bitrate: 48_000,     // matches the worker's `-b:a 48k`
  },
});
```

See [Converting media files > Audio options](https://mediabunny.dev/guide/converting-media-files#audio-options) for the full option set (`numberOfChannels`, `sampleRate`, `bitrate`, `codec`, `forceTranscode`, custom `process`, etc.) and [Media sources > Subjective qualities](https://mediabunny.dev/guide/media-sources#subjective-qualities) for the `QUALITY_*` constants you can pass to `bitrate` instead of a raw bps number.

Tuning is **not required** to ship this change — defaults produce a valid MP3 derivative — and is called out here so a follow-up optimization has an obvious starting point.

### Outcome mapping

The Mediabunny outcomes above map onto the existing three-state `ClientNormalizationOutcome` exactly as documented in [Decision: Map Mediabunny outcomes onto the existing three-state `ClientNormalizationOutcome` shape](#decision-map-mediabunny-outcomes-onto-the-existing-three-state-clientnormalizationoutcome-shape). Concretely:

- Steps 1–2 environment failures (no `Worker`, no WebCodecs decoder for any audio codec) → `{ kind: "unavailable" }`.
- Step 5 `conversion.isValid === false` → `{ kind: "unavailable" }`.
- Step 7 `ConversionCanceledError` caused by a caller abort → aborts the local submission before upload; no normalization outcome is sent to `prepare`.
- Step 7 any other thrown error → `{ kind: "failed" }`.
- Step 8 successful `output.target.buffer` → `{ kind: "succeeded", inputKind: "mp3-derivative" }`.

### Doc links cheat sheet

For the implementer of task 2.1, here are the Mediabunny pages worth keeping open:

- [Quick start](https://mediabunny.dev/guide/quick-start) — high-level snippets, including [Convert files](https://mediabunny.dev/guide/quick-start#convert-files) and [Extract audio](https://mediabunny.dev/guide/quick-start#extract-audio).
- [Converting media files](https://mediabunny.dev/guide/converting-media-files) — the full Conversion API (init, execute, cancel, isValid, discardedTracks, audio/video options, trim, tags).
- [Output formats > MP3](https://mediabunny.dev/guide/output-formats#mp3) — `Mp3OutputFormat` and its `xingHeader` option.
- [`@mediabunny/mp3-encoder`](https://mediabunny.dev/guide/extensions/mp3-encoder) — the LAME polyfill, why it is needed, and `registerMp3Encoder()` usage.
- [Reading media files > Input sources](https://mediabunny.dev/guide/reading-media-files#input-sources) — `BlobSource` and the other supported sources.
- [Input formats](https://mediabunny.dev/guide/input-formats) — what `ALL_FORMATS` includes.
- [Writing media files > `BufferTarget`](https://mediabunny.dev/guide/writing-media-files#buffertarget) and [`StreamTarget`](https://mediabunny.dev/guide/writing-media-files#streamtarget) (the latter for the future "stream into the presigned PUT" optimization).
- [Supported formats & codecs](https://mediabunny.dev/guide/supported-formats-and-codecs) — codec/container compatibility table and [`canEncodeAudio` / `canEncode`](https://mediabunny.dev/guide/supported-formats-and-codecs#querying-codec-encodability) reference.
- Full source-of-truth corpus: [`mediabunny.dev/llms-full.txt`](https://mediabunny.dev/llms-full.txt).

## Risks / Trade-offs

- [Bundle size grows by Mediabunny + `@mediabunny/mp3-encoder` for every authenticated submission surface] -> Mediabunny's "All features" bundle is ≈70 kB minified+gzipped per its own published numbers, and the MP3 encoder ships as a separate Worker-resident WASM blob loaded only when the encoder needs to register. This is materially smaller than the rejected `ffmpeg.wasm` bundle. The dependencies are imported only from `app/lib/client/media-normalization.ts` (and any code that calls it), so the workspace shell, public share routes, and auth routes remain unaffected.
- [Browsers without WebCodecs (notably some older Safari versions) cannot run Mediabunny conversion] -> `Conversion.init()` will report `isValid === false`, and `normalizeMediaForSubmission()` returns `{ kind: "unavailable" }`. The `optional` default policy then uploads the original file, exactly as it does today. Users on `required` policy (operator-flipped) get updated copy that explains the browser could not perform the required conversion and still recommends Chrome/Edge.
- [LAME MP3 encoder loads a WASM blob on first invocation] -> The first conversion on a session pays a small one-time WASM compile/instantiate cost. The encoder is registered lazily (only when `canEncodeAudio('mp3')` is false), and the LAME build is SIMD-enabled and worker-resident, so subsequent conversions on the same session reuse the loaded encoder.
- [`BufferTarget` keeps the produced MP3 in memory before upload] -> Bounded by `SUBMISSION_MAX_MEDIA_BYTES` and the dedicated form's documented 500 MB ceiling. MP3 outputs at typical meeting-voice bitrates are far smaller than the worst-case input. If we ever raise input ceilings materially, switch to `StreamTarget` and stream into the presigned `PUT` upload.
- [Mediabunny conversion failures are heterogeneous (decoder errors, OOM, missing codec)] -> Real conversion failures collapse into `{ kind: "failed" }` so the existing policy decision keeps working. User abort is handled separately as a non-error cancellation path, and the underlying non-cancel errors are still logged with the existing client logger for diagnostics without surfacing internal details to the user.
- [Worker pipeline has been carrying a `mp3-derivative` input branch that was never exercised in production submissions until this change] -> Add coverage that pushes a Mediabunny-produced MP3 (or a fixture MP3 standing in for one) through `processMeetingForWorker` end-to-end, so the first real exercise of that branch happens under test rather than in a user submission. Worker-side code itself is unchanged; this is verification only.
- [The placeholder-era `normalization_required_failed` wording says conversion "did not run"] -> This change owns updating that copy because supported browsers can now attempt conversion and still fail. Generic required-policy messaging must stay truthful for both `unavailable` and `failed`.
- [Mediabunny is a single-vendor open-source dependency on its lead maintainer] -> The library is MPL-2.0 and fully implemented in TypeScript with zero runtime dependencies. If maintenance ever falters, the existing `unavailable`/`failed` outcome shape lets us swap implementations behind `normalizeMediaForSubmission()` without touching any other surface.

## Migration Plan

This change is additive to existing in-flight submissions. There is no data migration, no DB schema change, and no breaking change to any wire format.

1. Add `mediabunny` and `@mediabunny/mp3-encoder` to `app/package.json` runtime dependencies, locked to current stable versions.
2. Replace the placeholder body of `normalizeMediaForSubmission()` in `app/lib/client/media-normalization.ts` with the Mediabunny implementation described above. Keep the exported server-facing outcome types unchanged, but treat user-initiated abort as a local cancellation path rather than a returned `{ kind: "failed" }` result.
3. Update the misleading code comment that mentions `@ffmpeg/ffmpeg` so it accurately describes the chosen vendor and the lazy encoder registration.
4. Add unit / integration coverage for `normalizeMediaForSubmission()`: success path produces an MP3 `File` with `inputKind: "mp3-derivative"`; environment-probe failure path returns `unavailable`; thrown-error path returns `failed`; user-initiated cancellation aborts the promise cleanly; the original `File` is preserved on non-success paths.
5. Add coverage that an MP3-derivative input flows end-to-end through `processMeetingForWorker` (using a fixture MP3 standing in for a Mediabunny-produced one), pinning down the previously-unexercised worker branch.
6. Verify behavior in the dedicated submission form and the shared upload manager:
   - Chromium-class browser: the UI shows an explicit `normalizing` / "Converting to MP3…" phase with progress, original audio/video file becomes an MP3 upload, and `optional` and `required` policies both succeed.
   - User-initiated cancel before upload starts: the conversion aborts cleanly, the dedicated form returns to idle, the upload-manager item disappears without a red error row, and no transcript work is queued.
   - Browser without WebCodecs: behaves exactly as today under `optional` (original-file upload) and shows truthful required-policy rejection copy under `required`.
   - Supported browser with a forced conversion failure: the required-policy message stays truthful and does not claim the browser never tried to convert.
7. Ship behind no feature flag. The behavior is policy-gated by the existing `mediaNormalizationPolicy`, which stays `optional` by default.

**Rollback strategy**

- Revert the implementation of `normalizeMediaForSubmission()` to the previous placeholder. The function signature and its return shape are stable, so no other surface needs to change.
- The `mediabunny` and `@mediabunny/mp3-encoder` dependencies can be removed in the same revert without touching server-side or worker-side code.
- Revert the accompanying local-normalization UX refinements (`normalizing` phase, visible progress, pre-upload cancel semantics, and updated copy) in the same rollback so the implementation and spec stay aligned.

## Open Questions

None blocking. Possible follow-ups that this change does not own:

- Flipping `DEFAULT_MEDIA_NORMALIZATION_POLICY` to `"required"` once Mediabunny success rates across the user base are understood.
- Replacing the worker's ffmpeg re-encode step with a passthrough when the input is already an MP3 derivative produced by Mediabunny.
- Streaming the produced MP3 directly into the presigned `PUT` upload instead of holding it in memory, if input ceilings are ever raised materially.
