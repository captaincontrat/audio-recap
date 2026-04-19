## Why

`meeting-import-processing` already requires the submission flow to perform browser-side MP3 normalization before upload handoff (audio → MP3; video → primary-audio extraction → MP3), and the policy machinery, prepare endpoint, and upload manager already speak in terms of `succeeded` / `unavailable` / `failed` outcomes. But the implementation in `app/lib/client/media-normalization.ts` is a placeholder that always returns `unavailable`, so every submission today silently falls through the `optional`-policy fallback path and uploads the original file unchanged. The end-to-end pipeline the product was designed around — browser produces MP3 → S3 transient input → worker drives MP3 through `libs/audio-recap` (`processMeetingForWorker`) → transcript / recap / title — never actually runs in its intended shape.

The vendor for this work was already chosen during scoping (`Mediabunny`, picked over `ffmpeg.wasm` for being web-native, materially lighter, and avoiding the COOP/COEP cross-origin-isolation requirement that would have clashed with the project's existing Google One Tap auth flow). That decision lives in the frozen `openspec/split-audit/add-web-meeting-processing-original/` snapshot but was lost from the active design when the original change was split, and the placeholder code's comment even still namechecks `@ffmpeg/ffmpeg` (the rejected option). This change ships the real Mediabunny integration and re-anchors the vendor choice in this change's `design.md`, so the active spec finally has a delivered implementation behind it.

## What Changes

- Add `mediabunny` as a runtime dependency of the Next.js app (`app/package.json`).
- Replace the placeholder implementation in `app/lib/client/media-normalization.ts` with a real Mediabunny-backed `normalizeMediaForSubmission()` that:
  - For `kind: "audio"` selections, attempts MP3 conversion of the selected audio.
  - For `kind: "video"` selections, attempts extraction of the primary audio track followed by MP3 conversion of that extracted audio.
  - Reports `succeeded` (with the produced MP3 derivative as the `file` to upload), `unavailable` (when the browser cannot run Mediabunny / WebCodecs), or `failed` (when a real conversion attempt threw) — preserving the existing server-facing `ClientNormalizationOutcome` and `MediaNormalizationResult` shapes so the prepare endpoint and policy enforcement keep working unchanged.
  - Treats user-initiated cancellation before upload starts as a local submission cancel path rather than a failed normalization result, so deliberate cancel does not leave behind a scary error state.
  - Performs the conversion off the main thread where Mediabunny supports it, and surfaces that work as an explicit local `normalizing` phase with visible progress, to keep the dedicated submission form and the shell upload manager responsive and trustworthy on large files.
- Re-record the Mediabunny vendor decision in this change's `design.md`, including the original rationale (web-native vs. ffmpeg-port, lighter bundle/memory profile, no COOP/COEP requirement, WebCodecs caveat for older Safari) and a link to `mediabunny.dev/guide/quick-start`.
- Update the misleading placeholder code comment (currently mentions `@ffmpeg/ffmpeg`) so it reflects the chosen vendor and the actual implementation.
- Default `mediaNormalizationPolicy` stays `optional` for fresh installs. Mediabunny actually performs conversion by default; browsers that cannot run it transparently fall back to uploading the original validated file, exactly as the active spec already permits.
- No worker-side changes. The existing `libs/audio-recap` pipeline (`processMeetingForWorker` → `prepareAudioForUpload` → `transcribePreparedAudio` → `generateMeetingSummary` → `generateMeetingTitle`) already handles both Mediabunny-produced MP3 inputs (`mediaInputKind: "mp3-derivative"`) and original-media inputs (`mediaInputKind: "original"`); shipping a real browser-side implementation simply exercises the MP3-derivative branch that was already specified and built.
- The active `meeting-import-processing` spec gains stricter user-visible behavior around normalization: the conversion attempt must be surfaced explicitly while it runs, progress must be shown when available, and canceling before upload starts must abort cleanly without being presented as a failure. The vendor name still lives in `design.md`, not in the spec, to avoid creating a requirement-level vendor lock-in.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `meeting-import-processing`: The existing requirement *"The submission flow applies the current normalization policy before upload handoff"* gains requirement-level detail for the real implementation's user experience: conversion is genuinely attempted on supported browsers, the client shows an explicit in-progress normalization state and progress when available, canceling before upload starts aborts cleanly without surfacing a failure, and the submission UI remains responsive while conversion runs. The vendor choice itself is captured in this change's `design.md`, not in the spec, to avoid creating a requirement-level vendor lock-in. If a follow-up change later flips the default policy from `optional` to `required`, that follow-up will own the additional requirement-level delta.

## Impact

- `app/` gains `mediabunny` as a runtime dependency. The dependency is browser-only at runtime; the worker bundle and server-only modules under `app/lib/server/**` MUST NOT import it.
- `app/lib/client/media-normalization.ts` becomes the single source of truth for browser-side MP3 normalization, with `normalizeMediaForSubmission()` returning real `succeeded` outcomes on supported browsers instead of always returning `unavailable`.
- The dedicated submission form (`app/components/features/meetings/new-meeting-form.tsx`) and the shared upload-manager submission runner (`app/components/workspace-shell/upload-manager/submission-runner.ts`) pick up small but important UX changes: an explicit local `normalizing` phase, visible conversion progress, a pre-upload cancel path that does not surface as `local_error`, and required-policy copy that stays truthful whether conversion was unavailable or actually attempted and failed.
- The server prepare endpoint (`app/app/api/workspaces/[slug]/meetings/prepare/route.ts`), the submission-decisions module (`app/lib/server/meetings/submission-decisions.ts`), and the database-backed `mediaNormalizationPolicy` machinery (`app/lib/server/meetings/normalization-policy.ts`, default `optional`) are unaffected; they continue to consume `BrowserNormalizationOutcome` exactly as today.
- The worker (`app/worker/processors/meetings.ts` → `processMeetingForWorker` from `audio-recap`) is unchanged. Once browsers start delivering real MP3 derivatives, the worker simply takes the MP3-derivative input branch that was already implemented, and the rest of the pipeline (transcribe → summarize → title → privacy-safe markdown → cleanup) is end-to-end verified for the first time in production submissions.
- Browser support narrows in practice on environments without WebCodecs (notably some older Safari versions), but only for the conversion path. Those browsers continue to upload the original file under the `optional` policy default, matching the existing spec contract.
- Privacy posture improves materially in the common case: when Mediabunny succeeds, no raw video or non-MP3 audio ever leaves the user's machine, even though transient inputs are still cleaned up server-side after terminal states.
