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

The processing job is an execution record owned by the transcript. It stores stage progress, retry counters, generic failure codes, and references to transient inputs needed by the worker.

**Why this over alternatives**

- Over creating a transcript record only on success: users would have no stable resource for status tracking or failed-attempt visibility.
- Over storing all execution state directly on the transcript row: a dedicated job record gives cleaner retry bookkeeping without overloading the durable product model.

### Decision: Use transient input storage outside Postgres, with references from the job record

Source media and notes will not be stored in Postgres. Instead:

- the server stores uploaded media in a transient worker-accessible blob location
- optional notes are stored as a transient text blob alongside the media
- the processing job stores only opaque references to those transient inputs

The storage implementation is an internal transient-input abstraction. Development can use a shared filesystem location; production can use another backend behind the same abstraction. The key requirement is that the worker can read the inputs and the platform can delete them deterministically.

**Why this over alternatives**

- Over storing media or notes in Postgres: large binary and text payloads do not belong in the system of record for this product.
- Over keeping notes only in Redis job payloads: the notes would still be durable inside queue infrastructure and harder to audit for deletion.

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
- source media kind (`audio` or `video`)
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
- [Transient-input abstractions add one more moving part] -> Limit the abstraction to create/read/delete semantics and keep the implementation swappable without changing transcript logic.
- [Timestamp normalization can introduce edge-case rounding drift] -> Use duration-ratio scaling, clamp to original media bounds, and keep segment ordering stable after normalization.
- [Dedicated title generation adds another LLM step] -> Use the same retry envelope as recap generation and keep the prompt narrowly scoped to title generation.
- [Cleanup-before-terminal-state can delay success visibility] -> Keep cleanup fast, make it idempotent, and isolate it as a short finalization stage rather than mixing it into content generation steps.

## Migration Plan

1. Build the submission and job-tracking schema on top of the platform/auth foundations from the previous change.
2. Refactor `libs/audio-recap` so the worker can call reusable processing helpers and a new web-safe rendering path.
3. Add the authenticated submission endpoint and transcript-status surfaces in `app/server`.
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
