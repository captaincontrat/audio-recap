## Context

The previous change, `bootstrap-meeting-recap-web-platform`, established the runtime topology for a browser app, authenticated API/BFF, and background worker under `app/`, with Postgres as the durable source of truth, Redis for asynchronous coordination, and `libs/audio-recap` as the shared pipeline core rather than a CLI-only tool.

This change adds the first end-to-end product workflow on top of that foundation: a verified authenticated user submits one audio or video file and optional notes, the worker processes the submission asynchronously, and the system persists a transcript record as the durable product resource.

The current CLI already provides the building blocks:

- ffmpeg preprocessing and chunking
- diarized transcription with chunk merging
- transcript artifact construction
- recap generation with meeting notes when available

But it is not yet web-safe in three important ways:

- it assumes local filesystem paths as inputs and outputs
- it treats the CLI process as the orchestration boundary
- it renders timestamps in accelerated-audio time rather than original media time

This change must solve those gaps while preserving the privacy constraints from the brief: source media and transient notes are not durable product content.

## Goals / Non-Goals

**Goals:**

- Define the authenticated upload and asynchronous processing workflow for one audio or video submission.
- Define a database-backed browser-side media-normalization policy that can make Mediabunny normalization optional or required before upload.
- Define the durable transcript record and the minimum privacy-safe metadata it keeps.
- Specify user-visible processing states, retry behavior, and terminal failure behavior.
- Require reuse of the existing media/transcription/summarization pipeline through shared library code in `libs/audio-recap`.
- Normalize transcript timestamps back to original media time before persistence.
- Guarantee deletion of source media and transient notes after the job reaches a terminal state.

**Non-Goals:**

- Transcript library organization features such as renaming, tags, favorites, sorting, and search.
- Public sharing URLs and export formats.
- Billing, teams, admin tooling, or public APIs.
- Long-term retention of source media or user-submitted notes.
- Human editing of generated transcript or recap content.

## Decisions

### Decision: Create a transcript record immediately, then drive processing through a separate job record

Each authenticated submission creates two durable records in Postgres:

- a `transcript` record, which is the long-lived product resource
- a `processing_job` record, which tracks attempts, stages, and transient execution state

The transcript record exists from submission time onward so the user has a stable object to poll, revisit, and later manage. Its initial state is pending, with canonical markdown fields unset until the worker succeeds.

The processing job is an execution record owned by the transcript. It stores stage progress, retry counters, generic failure codes, references to transient inputs needed by the worker, and the media-normalization policy snapshot that governed intake for that submission.

**Why this over alternatives**

- Over creating a transcript record only on success: users would have no stable resource for status tracking or failed-attempt visibility.
- Over storing all execution state directly on the transcript row: a dedicated job record gives cleaner retry bookkeeping without overloading the durable product model.

### Decision: Use transient input storage outside Postgres, with references from the job record

Source media and notes will not be stored in Postgres. Instead:

- uploaded media is stored in transient S3-compatible object storage
- production uses private AWS S3, while local development and CI use MinIO or another ephemeral S3-compatible service
- optional notes are stored as a transient text object alongside the media in the same storage system
- the processing job stores only opaque references to those transient inputs

The storage implementation is a narrow internal S3-compatible abstraction shared across environments. The product will not maintain separate shared-filesystem and object-storage code paths. This keeps upload, worker download, cleanup, and end-to-end test behavior aligned across local development, CI, and Heroku deployment.

Heroku-friendly implementations should prefer direct browser-to-object-storage uploads via short-lived presigned URLs rather than proxying large media files through the app server. That still exercises the same S3-compatible path in production, local development, and CI whether the browser uploads the original validated source file or a browser-normalized MP3 derivative.

The bucket configuration must explicitly allow the direct browser upload path. At minimum, it must allow browser-origin CORS for the presigned upload method used by the platform, currently `PUT`, from:

- local development app origins
- CI browser-test app origins when end-to-end tests exercise uploads through a browser
- production web-app origins

Required request headers for the presigned upload flow must also be allowed, or local and CI upload tests will fail even when the backend signing logic is correct.

**Why this over alternatives**

- Over storing media or notes in Postgres: large binary and text payloads do not belong in the system of record for this product.
- Over using a shared filesystem in development: filesystem-only development would diverge from Heroku production and add extra boilerplate.
- Over keeping notes only in Redis job payloads: the notes would still be durable inside queue infrastructure and harder to audit for deletion.
- Over proxying large media uploads through the app server: presigned uploads reduce dyno memory and timeout pressure while keeping object lifecycle under first-party control.

### Decision: Use a database-backed Mediabunny normalization policy before direct upload

Before direct upload begins, the Next.js web runtime reads a Postgres-backed submission setting:

- `mediaNormalizationPolicy`: `optional` or `required`

This setting is operator-controlled in the database. No admin UI for changing it is included in this change.

For each accepted submission, the current policy is snapshotted into the processing job so in-flight submissions keep stable behavior even if the operator flips the database switch later.

Normalization rules:

- when the user selects an audio file, the browser tries to convert it to MP3 before upload
- when the user selects a video file, the browser tries to extract the primary audio track and upload that extracted audio as MP3
- when `mediaNormalizationPolicy` is `optional`, browser-side extraction or conversion may fail and the submission flow falls back to uploading the original validated file unchanged
- when `mediaNormalizationPolicy` is `required`, browser-side extraction or conversion must succeed before queueing; otherwise the submission is rejected before upload handoff completes
- raw video upload remains supported as a fallback path only while the current policy is `optional`, and original audio upload remains the fallback only while the current policy is `optional`

This policy changes submission-intake strictness, but it does not change the durable content contract. The product still accepts one user-selected audio or video file per submission. The transcript record keeps `source media kind` as the user's original selected kind, while the job input may be either the original validated media file or a browser-produced MP3 derivative.

The browser-side normalization tool for this change is [`Mediabunny`](https://mediabunny.dev/guide/introduction), using the browser APIs and flows documented in its [quick start guide](https://mediabunny.dev/guide/quick-start).

**Why this over alternatives**

- Over an environment-variable or deploy-time toggle: a database-backed policy lets the operator change intake strictness without redeploying the application.
- Over re-evaluating the latest policy while a submission is already in progress: snapshotting the policy onto the job prevents in-flight uploads from changing behavior unexpectedly.
- Over requiring browser-side extraction or conversion for every submission: browser codec support still varies, so an `optional` mode preserves a reliable fallback path.
- Over using `ffmpeg.wasm` as the default upload-time optimization path: `Mediabunny` is more aligned with a narrow browser-native normalization task and avoids the heavier bundle and memory profile of a full FFmpeg port.
- Over leaving all video and audio normalization to the worker: opportunistic client-side MP3 conversion can reduce upload size and server-side preprocessing work when the browser can do it safely.

### Decision: Processing runs only through shared `libs/audio-recap` modules, not CLI subprocesses

The worker will orchestrate processing by importing shared library functions from `libs/audio-recap`:

- media inspection and preprocessing
- chunk planning and extraction
- diarized transcription
- overlap-aware segment merge
- transcript block construction
- recap generation
- new title-generation and web-safe rendering helpers added under the same shared package

The worker must not run `pnpm process:meeting`, invoke `tsx src/cli.ts`, or depend on stdout parsing for normal operation.

**Why this over alternatives**

- Over subprocess CLI execution: retry behavior, stage tracking, cleanup ordering, and typed failure categorization become much harder.
- Over reimplementing the pipeline inside `app/`: that would split core processing logic and create drift between CLI and web behavior.

### Decision: Normalize timestamps to original media time before building canonical markdown

The current CLI keeps timestamps aligned to the accelerated x2 preprocessing audio. The web product will not persist that timeline.

The worker will capture both:

- original source duration from the submitted media
- prepared-audio duration from the shared preprocessing step

It will then rescale merged transcript segments back to original-media time using a normalization factor derived from those two durations before transcript blocks and markdown are built. This avoids baking prepared-audio timestamps into the durable product and is more robust than hard-coding a fixed `x2` multiplier.

**Why this over alternatives**

- Over persisting prepared-audio time: users expect timestamps to match the media they submitted, not an internal optimization artifact.
- Over multiplying blindly by `2`: using the observed duration ratio handles encoding drift and future preprocessing changes more safely.

### Decision: Persist privacy-safe canonical markdown only

The transcript record will persist canonical markdown fields:

- `transcriptMarkdown`
- `recapMarkdown`

These fields are the durable content contract for future detail pages, sharing, and export flows.

The web rendering path must strip the CLI's local-only metadata such as:

- local file paths
- temporary storage paths
- notes file paths
- storage object keys

Durable metadata stored alongside the markdown is intentionally minimal:

- transcript identifier
- owner identifier
- processing status
- AI-generated title
- source media kind (the user's original selected kind: `audio` or `video`)
- original media duration
- `submittedWithNotes` flag
- created/updated/completed timestamps
- generic failure code and generic failure summary when terminally failed

The system must not persist original filenames, raw notes, raw provider payloads, temporary blob references, or machine-specific filesystem paths as part of the durable transcript record.

**Why this over alternatives**

- Over storing the current CLI markdown as-is: it leaks local-path metadata and documents the wrong time base.
- Over persisting more submission metadata for convenience: the brief favors retention minimization over future debugging convenience.

### Decision: Use explicit processing stages and bounded automatic retries

The job lifecycle will expose these stages:

- `queued`
- `preprocessing`
- `transcribing`
- `generating_recap`
- `generating_title`
- `finalizing`
- `retrying`
- `completed`
- `failed`

Retry behavior:

- validation failures are non-retryable and fail immediately
- transient infrastructure or provider failures are retried automatically up to three total attempts
- retries use bounded backoff and keep the same transcript record
- after the last retry is exhausted, the transcript becomes terminally failed with a generic failure summary

The browser polls the transcript record or a transcript-status endpoint and receives stage information suitable for user-facing progress messaging without exposing provider internals.

**Why this over alternatives**

- Over a single boolean status: users need meaningful progress and failure visibility for a multi-stage pipeline.
- Over unbounded retries: they hide stuck work, delay cleanup, and make deletion guarantees harder to reason about.

### Decision: Terminal states are published only after cleanup of transient inputs

The worker finalization order is:

1. write the successful content or generic failure summary to Postgres with `finalizing` status
2. delete transient media and transient notes
3. update the transcript record to `completed` or `failed`

This means terminal states carry a strong guarantee: once the user sees `completed` or `failed`, the source media and transient notes are already gone from transient storage.

If cleanup itself fails, the job stays non-terminal and enters retry behavior until cleanup succeeds or the system records a cleanup-class failure that still completes the deletion contract before publishing the terminal state.

**Why this over alternatives**

- Over marking the record terminal before cleanup: that would violate the strict deletion promise in the brief.

### Decision: Generate the title as an explicit worker stage

Successful processing must produce a non-empty AI-generated transcript title suitable for list views and later management features. Title generation will be a dedicated shared-library step that runs after recap generation and uses the normalized transcript content and recap as inputs.

Keeping title generation as a separate stage preserves the existing recap markdown contract and makes failures visible in status tracking.

**Why this over alternatives**

- Over overloading recap generation to return mixed structured output: it would make the current markdown contract more brittle.
- Over deferring title generation to the browser: title generation belongs with server-owned canonical content.

## Risks / Trade-offs

- [Creating transcript rows before success means failed items can persist] -> Keep failed records privacy-minimal, store only generic error summaries, and allow later management features to delete or retry them.
- [S3-compatible storage and presigned uploads add endpoint and CORS configuration] -> Keep one env-var contract for AWS S3 and MinIO, auto-create local and CI buckets, configure browser-direct `PUT` upload CORS for local/CI/prod origins, and run end-to-end coverage against the same S3-compatible path.
- [Database-backed normalization policy can change while users are mid-submission] -> Snapshot the current policy onto the processing job and apply policy flips only to new submissions.
- [Browser-side MP3 normalization can behave differently across browsers and codecs] -> In `optional` mode, fall back to the original validated file; in `required` mode, block queueing with a clear user-visible validation error when normalization cannot complete.
- [Timestamp normalization can introduce edge-case rounding drift] -> Use duration-ratio scaling, clamp to original media bounds, and keep segment ordering stable after normalization.
- [Dedicated title generation adds another LLM step] -> Use the same retry envelope as recap generation and keep the prompt narrowly scoped to title generation.
- [Cleanup-before-terminal-state can delay success visibility] -> Keep cleanup fast, make it idempotent, and isolate it as a short finalization stage rather than mixing it into content generation steps.

## Migration Plan

1. Build the submission and job-tracking schema on top of the platform/auth foundations from the previous change.
2. Refactor `libs/audio-recap` so the worker can call reusable processing helpers and a new web-safe rendering path.
3. Add the authenticated submission endpoint and transcript-status surfaces in the Next.js web runtime, including database-backed `Mediabunny` normalization policy enforcement before direct upload.
4. Add worker execution for preprocessing, transcription, recap generation, title generation, timestamp normalization, persistence, and cleanup.
5. Persist canonical transcript records and enforce terminal cleanup guarantees for transient media and notes.
6. Layer later transcript management, sharing, and export changes on top of the resulting transcript record model.

Rollback strategy:

- keep the CLI workflow untouched as a stable fallback
- disable new submission routes if the worker path is unstable
- stop queue consumption without affecting existing auth flows
- preserve already-created transcript records in Postgres even if processing intake is paused

## Open Questions

None are blocking for this change. Later changes will define list/detail transcript management, public sharing, and frontend export behavior on top of the transcript record introduced here.
