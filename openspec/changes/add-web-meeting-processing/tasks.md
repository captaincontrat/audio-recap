## 1. Submission And Persistence Foundations

- [ ] 1.1 Add the Postgres schema and migrations for transcript records, processing-job records, processing statuses, generic failure fields, and privacy-safe transcript metadata.
- [ ] 1.2 Implement the transient input storage abstraction for uploaded media and optional notes, including create/read/delete operations usable by both the server and worker.
- [ ] 1.3 Implement the authenticated submission endpoint that validates one audio/video file plus optional notes, creates the transcript and processing-job records, stores transient inputs, and enqueues the job.

## 2. Shared Processing Pipeline

- [ ] 2.1 Refactor `libs/audio-recap` so the worker can import reusable preprocessing, transcription, transcript-artifact, recap-generation, and rendering helpers without invoking the CLI entrypoint.
- [ ] 2.2 Add shared-library support for AI transcript title generation and privacy-safe markdown rendering that omits local-path metadata.
- [ ] 2.3 Add timestamp-normalization helpers that rescale merged transcript segments from prepared-audio time back to original media time before canonical markdown is built.

## 3. Worker Lifecycle And Cleanup

- [ ] 3.1 Implement worker execution for the `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, and `finalizing` stages using the shared pipeline modules.
- [ ] 3.2 Implement retry classification, bounded automatic retries, `retrying` status updates, and generic terminal failure summaries without creating duplicate transcript records.
- [ ] 3.3 Implement terminal cleanup ordering so transient media and transient notes are deleted before a transcript is marked `completed` or `failed`.

## 4. App And API Status Surfaces

- [ ] 4.1 Build the protected web submission flow in `app/` for uploading one audio/video file and optional notes with pre-queue validation feedback.
- [ ] 4.2 Add transcript-status read surfaces that let the browser poll and display queued, in-progress, retrying, completed, and failed states from the transcript record.
- [ ] 4.3 Render completed transcript records from canonical `transcriptMarkdown`, `recapMarkdown`, title, and privacy-safe metadata rather than from transient input data.

## 5. Validation And Regression Coverage

- [ ] 5.1 Add automated coverage for submission validation, transcript-record creation, and transient-input handling.
- [ ] 5.2 Add automated coverage for worker orchestration, timestamp normalization, recap/title generation, retry behavior, and generic failure handling.
- [ ] 5.3 Add automated coverage for retention guarantees, including deletion of source media and transient notes before terminal transcript states are published.
