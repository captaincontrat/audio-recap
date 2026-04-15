## 1. Submission And Persistence Foundations

- [ ] 1.1 Add the Postgres schema and migrations for transcript records, processing-job records, a database-backed `mediaNormalizationPolicy` setting, policy snapshots captured on accepted submissions, processing statuses, generic failure fields, and privacy-safe transcript metadata.
- [ ] 1.2 Implement the transient S3-compatible input storage abstraction for uploaded media and optional notes, including MinIO-backed local/CI usage, bucket bootstrap, browser-direct `PUT` upload CORS configuration for local/CI/prod origins, and create/read/delete operations usable by both the Next.js web runtime and worker.
- [ ] 1.3 Implement the authenticated submission initiation flow in the Next.js web runtime that validates one audio/video file plus optional notes, reads the current database-backed normalization policy, issues short-lived presigned upload details, accepts either original media uploads or browser-normalized MP3 uploads according to that policy, creates the transcript and processing-job records, and enqueues the job once upload handoff succeeds.

## 2. Shared Processing Pipeline

- [ ] 2.1 Refactor `libs/audio-recap` so the worker can import reusable preprocessing, transcription, transcript-artifact, recap-generation, and rendering helpers without invoking the CLI entrypoint.
- [ ] 2.2 Add shared-library support for AI transcript title generation and privacy-safe markdown rendering that omits local-path metadata.
- [ ] 2.3 Add timestamp-normalization helpers that rescale merged transcript segments from prepared-audio time back to original media time before canonical markdown is built.

## 3. Worker Lifecycle And Cleanup

- [ ] 3.1 Implement worker execution for the `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, and `finalizing` stages using the shared pipeline modules for both original media uploads and browser-normalized MP3 derivatives.
- [ ] 3.2 Implement retry classification, bounded automatic retries, `retrying` status updates, and generic terminal failure summaries without creating duplicate transcript records.
- [ ] 3.3 Implement terminal cleanup ordering so transient media and transient notes are deleted before a transcript is marked `completed` or `failed`.

## 4. App And API Status Surfaces

- [ ] 4.1 Build the protected web submission flow in `app/` for direct browser-to-S3-compatible upload of one audio/video file and optional notes with pre-queue validation feedback, `Mediabunny` normalization, MP3 conversion for selected audio files, video-to-audio MP3 extraction for selected video files, raw-source fallback in `optional` mode, and clear rejection UX in `required` mode when local conversion fails.
- [ ] 4.2 Add transcript-status read surfaces that let the browser poll and display queued, in-progress, retrying, completed, and failed states from the transcript record.
- [ ] 4.3 Render completed transcript records from canonical `transcriptMarkdown`, `recapMarkdown`, title, and privacy-safe metadata rather than from transient input data.

## 5. Validation And Regression Coverage

- [ ] 5.1 Add automated coverage for submission validation, database-backed normalization policy reads and snapshots, browser-side normalization behavior in both `optional` and `required` modes, presigned upload initiation, transcript-record creation, and transient-input handling against the MinIO-backed local/CI storage path.
- [ ] 5.2 Add automated coverage for worker orchestration, timestamp normalization, recap/title generation, retry behavior, and generic failure handling.
- [ ] 5.3 Add automated coverage for retention guarantees, including deletion of source media and transient notes before terminal transcript states are published.
