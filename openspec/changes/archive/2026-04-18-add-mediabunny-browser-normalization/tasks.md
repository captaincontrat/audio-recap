## 1. Dependencies

- [x] 1.1 Add `mediabunny` and `@mediabunny/mp3-encoder` to `app/package.json` runtime dependencies at the latest stable versions; install via `pnpm` so the workspace lockfile updates cleanly.
- [x] 1.2 Confirm both packages are imported only from client-side modules (no `import "server-only"` files import them, and `app/worker/**` does not import them) so the worker bundle and server-only modules stay free of `mediabunny`.

## 2. Browser-side normalization implementation

> Walk through the end-to-end pipeline in `design.md` → "How Mediabunny normalizes any media file to MP3" while implementing this section. Doc cheat sheet:
> - Conversion API surface: <https://mediabunny.dev/guide/converting-media-files>
> - `Mp3OutputFormat` options: <https://mediabunny.dev/guide/output-formats#mp3>
> - LAME polyfill (`registerMp3Encoder`): <https://mediabunny.dev/guide/extensions/mp3-encoder>
> - `BlobSource` and other input sources: <https://mediabunny.dev/guide/reading-media-files#input-sources>
> - `ALL_FORMATS` and per-format singletons: <https://mediabunny.dev/guide/input-formats>
> - `BufferTarget` (and `StreamTarget` for the future streaming-upload optimization): <https://mediabunny.dev/guide/writing-media-files#buffertarget>
> - `canEncodeAudio` and codec/container compatibility: <https://mediabunny.dev/guide/supported-formats-and-codecs>

- [x] 2.1 Replace the body of `normalizeMediaForSubmission()` in `app/lib/client/media-normalization.ts` with the Mediabunny-backed flow described in `design.md` (lazy `registerMp3Encoder()` gated on `canEncodeAudio('mp3')`, single shared `Mp3OutputFormat` for both audio and video selections).
- [x] 2.2 Map real Mediabunny conversion outcomes onto the existing `ClientNormalizationOutcome` shape exactly per the table in `design.md`: missing browser prerequisites or `Conversion.init().isValid === false` → `unavailable`; successful execute → `succeeded` (`inputKind: "mp3-derivative"`); non-cancel thrown error → `failed`. Do not change the exported server-facing outcome types (`ClientNormalizationOutcome`, `MediaNormalizationResult`).
- [x] 2.3 On success, wrap the produced `ArrayBuffer` in a `File` with a `.mp3` filename derived from the original basename and `type: "audio/mpeg"`, and return it as the `file` to upload.
- [x] 2.4 On non-success outcomes (`unavailable`, `failed`), return the original `source.file` unchanged so the existing `optional`-policy fallback path keeps working.
- [x] 2.5 Replace the existing `hasSharedArrayBufferSupport()` probe with a Mediabunny-appropriate environment check (presence of `Worker`, presence of WebCodecs encoders/decoders Mediabunny needs). Returning `unavailable` on environments that fail this probe replaces the current `SharedArrayBuffer` heuristic.
- [x] 2.6 Replace the misleading file-level comment block at the top of `app/lib/client/media-normalization.ts` (currently mentions `@ffmpeg/ffmpeg`, COOP/COEP, and SharedArrayBuffer) with an accurate description of the Mediabunny + LAME flow and a link to `mediabunny.dev`.

## 3. Local normalization status, cancellation, and progress wiring

> Mediabunny cancellation: <https://mediabunny.dev/guide/converting-media-files#canceling-a-conversion> (`conversion.cancel()` rejects the in-flight `execute()` with `ConversionCanceledError` and frees the encoder Worker).
> Mediabunny progress: <https://mediabunny.dev/guide/converting-media-files#monitoring-progress> (`conversion.onProgress = (n) => …` where `n ∈ [0, 1]`).

- [x] 3.1 Expose a way for callers to cancel an in-flight conversion (e.g. accept an optional `AbortSignal` on `MediaNormalizationSource` / `submitMeeting()`). Implement the abort by calling `conversion.cancel()`, freeing the encoder Worker, and surfacing user-initiated cancellation as a local submission cancel path rather than a returned `{ kind: "failed" }` normalization result.
- [x] 3.2 Split the current coarse `preparing` local phase into an explicit `normalizing` phase plus the short post-conversion `preparing` step, and update the upload-manager store/tray plus the dedicated submission form so long-running browser conversion is labeled truthfully.
- [x] 3.3 Wire the upload-manager's per-item cancel/remove path and the dedicated submission form's cancel/reset affordance to the new abort hook while the submission is still in pre-upload local phases, so canceling mid-conversion frees the encoder Worker promptly and returns the UI to a non-error state.
- [x] 3.4 Surface `conversion.onProgress` to both the upload-manager item state and the dedicated submission form so long conversions show visible movement instead of a static spinner or generic "Preparing…" copy.
- [x] 3.5 Update the `normalization_required_failed` messaging in the tray and the dedicated form so it stays truthful for both unsupported-browser (`unavailable`) and attempted-but-failed (`failed`) normalization paths; do not keep placeholder-era "conversion did not run" wording as the generic message.

## 4. Unit tests for the normalization function

- [x] 4.1 Add `app/test/lib/client/media-normalization.test.ts` (vitest, jsdom). Cover: success path returns `{ kind: "succeeded", inputKind: "mp3-derivative" }` with an MP3 `File` whose `.type` is `audio/mpeg` and whose `.name` ends in `.mp3`.
- [x] 4.2 Cover the unavailable path: stub the environment probe to fail and assert the function returns `{ kind: "unavailable" }` with the original `file` unchanged.
- [x] 4.3 Cover the failed path: stub `Conversion.init`/`execute` to throw and assert the function returns `{ kind: "failed" }` with the original `file` unchanged.
- [x] 4.4 Cover the `Conversion.isValid === false` path (e.g. simulate "no decodable audio track") and assert the function returns `{ kind: "unavailable" }` with the original `file` unchanged.
- [x] 4.5 Cover the cancellation path: trigger the abort hook mid-conversion and assert the function aborts cleanly (for example with an abort-shaped rejection) without leaking the encoder Worker or returning a misleading `{ kind: "failed" }` result for user-initiated cancel.

## 5. End-to-end pipeline verification

- [x] 5.1 Add (or extend) a worker-side test that pushes a real MP3 fixture (small, repo-tracked) through `processMeetingForWorker` from `audio-recap` with `mediaInputKind: "mp3-derivative"`, asserting the previously-unexercised MP3-derivative branch reaches the success path through `prepareAudioForUpload` → `transcribePreparedAudio` (mocked OpenAI) → `generateMeetingSummary` (mocked) → `generateMeetingTitle` (mocked).
- [x] 5.2 Add an integration test (or extend an existing submission-runner test) that exercises a successful normalization path, asserting the local phase sequence is `normalizing` → `preparing` → `uploading` → `finalizing`, the prepare endpoint receives `normalization: { kind: "succeeded", inputKind: "mp3-derivative" }`, and the uploaded `File` is the MP3 derivative (not the original).
- [x] 5.3 Add an integration test for user-initiated cancel during the `normalizing` phase, asserting the conversion aborts, no `prepare` / upload / finalize request completes, and the upload-manager item or dedicated form returns to a non-error state rather than `local_error`.
- [x] 5.4 Re-run the existing submission-runner tests and the existing `evaluateSubmission()`/`submission-decisions` tests to confirm no regression in the `optional`-fallback or `required`-rejection paths.

## 6. Static checks

- [x] 6.1 Run `pnpm typecheck` from the repo root (and from `app/` if needed) and fix any newly-introduced type errors in the normalization module, the upload-manager wiring, and the new tests.
- [x] 6.2 Run `pnpm --filter ./app check` (Biome) and fix any lint/format violations introduced by the change. Do not silence rules.
- [x] 6.3 Run `pnpm --filter ./app test` and ensure the new and existing vitest suites pass.

## 7. Manual / browser verification

- [x] 7.1 In a Chromium-class browser (Chrome or Edge), submit a small audio file via the dedicated submission form and confirm the upload payload's `Content-Type` is `audio/mpeg` and the worker logs show `mediaInputKind: "mp3-derivative"` for the resulting job.
- [x] 7.2 In a Chromium-class browser, submit a small video file via the dedicated submission form and confirm the upload payload's `Content-Type` is `audio/mpeg` (audio extracted) and the worker reaches `completed` for the resulting transcript.
- [x] 7.3 In a browser without WebCodecs (or with WebCodecs disabled), submit the same audio file and confirm the original-file fallback under `optional` policy mode is taken (`Content-Type` matches the original; no MP3 produced; transcript still completes).
- [x] 7.4 With operator-flipped `mediaNormalizationPolicy = "required"`, confirm browsers that cannot run Mediabunny get truthful unsupported-browser copy, browsers where conversion is forced to fail get truthful attempted-but-failed copy, and a Chromium-class browser with a normal file still succeeds.
- [x] 7.5 Confirm the submission UI shows an explicit `normalizing` / "Converting to MP3…" phase with visible progress on a large-file conversion rather than only a generic `Preparing…` state.
- [x] 7.6 Confirm the submission UI (form fields, notes textarea, navigation, cancel button, and shell upload-manager tray) remains interactive while a large-file conversion is in progress, and that canceling before upload starts aborts cleanly without queueing transcript work or surfacing a red error state.

## 8. OpenSpec finalization

- [x] 8.1 Re-run `openspec validate add-mediabunny-browser-normalization` and confirm the change still validates after implementation lands.
- [x] 8.2 Once everything in tasks 1–7 is checked, archive the change with the openspec archive workflow so the spec deltas are merged into `openspec/specs/meeting-import-processing/spec.md`.
