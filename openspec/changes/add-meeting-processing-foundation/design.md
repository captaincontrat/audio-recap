## Context

The reduced platform bootstrap already establishes the web runtime, worker entrypoint, Postgres, Redis, and verified-user auth foundation. The current `add-web-meeting-processing` change was intended to add the first real product workflow on top of that base, but it also absorbed the lower-level storage and pipeline refactors that were split out of bootstrap.

Those foundations are real work, but they are not the same thing as the transcript/job lifecycle contract that downstream transcript management and sharing changes build on. This change isolates the shared processing platform so later product-facing processing artifacts can reference a smaller, more stable dependency.

## Goals / Non-Goals

**Goals:**

- Define one S3-compatible transient-input storage contract for production, local development, and CI.
- Define the presigned browser-direct upload contract and the environment parity requirements that make it safe to use across AWS S3 and MinIO-like services.
- Refactor `libs/audio-recap` into importable preprocessing, transcription, merge, recap, and rendering modules that a worker can call directly.
- Add shared title-generation, privacy-safe markdown, and timestamp-normalization helpers suitable for durable downstream persistence.
- Define worker-facing processing interfaces that can consume either original validated uploads or browser-produced MP3 derivatives.

**Non-Goals:**

- Creating transcript rows, processing-job rows, or ownership rules.
- Defining user-visible submission UX, status polling, retry semantics, or terminal failure summaries.
- Defining the cleanup-before-terminal-state contract for durable transcript records.
- Defining transcript management, public sharing, or export behavior.

## Decisions

### Decision: Use one S3-compatible transient-input storage contract across every environment

The web product will use one internal transient storage abstraction for uploaded media and optional notes:

- production uses private AWS S3
- local development and CI use MinIO or another ephemeral S3-compatible service
- the same abstraction handles object creation, presigned upload preparation, object reads for worker download, and deletes used by downstream lifecycle work

This change owns the storage contract and its environment-parity requirements, but it does not define when a transcript becomes terminal or when cleanup is considered complete. That higher-level sequencing remains in the reduced `add-web-meeting-processing` change.

**Why this over alternatives**

- Over separate filesystem and object-storage paths: that would create environment drift and increase test blind spots.
- Over leaving storage details implicit inside the product workflow change: the storage contract is large enough to deserve its own smaller capability boundary.

### Decision: Support browser-direct uploads through short-lived presigned `PUT` requests

Large media files should not be proxied through the Heroku web process. The storage contract therefore includes short-lived presigned `PUT` upload details and the bucket configuration required to make them work:

- local development origins
- CI browser-test origins
- production web-app origins
- the headers required by the presigned upload flow

This change owns the upload contract itself, but not the submission workflow that decides when a presigned request is issued or when a successful upload becomes an accepted transcript submission.

**Why this over alternatives**

- Over server-proxied uploads: direct upload reduces dyno memory and timeout pressure.
- Over pushing CORS/header configuration into later product docs: the contract is incomplete if those requirements are not captured alongside presigned upload behavior.

### Decision: Make `libs/audio-recap` importable shared library code and keep the CLI as a thin wrapper

The worker-facing processing path will import shared modules from `libs/audio-recap` for:

- media inspection and preprocessing
- chunk planning and extraction
- diarized transcription
- overlap-aware segment merge
- transcript artifact construction
- recap generation

The CLI remains supported, but it becomes a wrapper around the shared modules instead of the orchestration boundary that web processing has to shell out to.

**Why this over alternatives**

- Over invoking the CLI as a subprocess: worker retries, stage tracking, and cleanup sequencing become brittle when the pipeline boundary is stdout and exit codes.
- Over reimplementing the processing pipeline inside `app/`: that would create logic drift between CLI and web processing.

### Decision: Put title generation, privacy-safe markdown rendering, and timestamp normalization in the shared processing layer

The shared foundation will expose helpers that downstream lifecycle changes can call after transcript generation:

- AI title generation as a distinct helper
- markdown rendering that omits local file paths, temporary paths, notes paths, and storage object keys
- timestamp normalization that rescales merged segments from prepared-audio time back to original submitted-media time using the observed duration ratio

This keeps the canonical-output logic aligned wherever the processing pipeline is consumed, while leaving durable persistence and retention guarantees to the reduced product-facing processing change.

**Why this over alternatives**

- Over keeping these helpers in `app/worker`: they are pipeline-shaped concerns and should stay with the shared processing code.
- Over hard-coding a fixed `x2` multiplier for timestamps: the duration-ratio approach is safer against encoding drift and future preprocessing changes.

### Decision: Define worker-facing processing interfaces that accept both original uploads and browser-produced MP3 derivatives

The shared processing contract must accept either:

- an original validated audio or video upload
- a browser-produced MP3 derivative created during optional or required client-side normalization

This change does not own the intake policy or durable transcript metadata, but it does own the shared interfaces that let downstream lifecycle work consume either input shape without branching into separate processing stacks.

**Why this over alternatives**

- Over making the shared pipeline assume only original uploads: it would force downstream code to special-case browser normalization.
- Over making the foundation own the normalization policy itself: intake rules belong with the transcript submission lifecycle.

## Risks / Trade-offs

- [Splitting the foundation out could weaken the end-to-end narrative] -> Keep the reduced `add-web-meeting-processing` change explicitly dependent on this change and cross-reference the shared contracts where needed.
- [Browser-direct uploads depend on subtle CORS/header rules] -> Capture the exact environment parity expectations in this change rather than leaving them implicit.
- [Library-first refactors can accidentally break the CLI] -> Preserve the CLI as a thin wrapper over the same shared modules and keep parity coverage in this foundation change.
- [Timestamp normalization and privacy-safe rendering may look product-specific] -> Keep persistence and lifecycle semantics out of this change so it remains a narrow processing foundation rather than another monolith.

## Migration Plan

1. Carve storage, presigned-upload, and shared-pipeline decisions out of `add-web-meeting-processing`.
2. Define the importable `libs/audio-recap` surfaces and preserve the CLI as a wrapper over the shared pipeline.
3. Define the S3-compatible transient storage contract and environment parity requirements for AWS S3 and MinIO.
4. Let the reduced `add-web-meeting-processing` change consume these storage and processing contracts for submission, worker lifecycle, retries, and retention.

Rollback strategy:

- keep the CLI workflow usable while the shared-library refactor lands
- keep later submission and worker lifecycle behavior in `add-web-meeting-processing`
- treat this change as inert until the downstream processing change starts consuming the new contracts

## Open Questions

None are blocking for this split. The reduced `add-web-meeting-processing` change will own the product-facing decisions about submission acceptance, transcript persistence, retries, and retention semantics.
