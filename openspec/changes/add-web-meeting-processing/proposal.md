## Why

The platform and authentication foundation is now defined, but the web product still lacks the core value path: accepting meeting media, turning it into a durable transcript record, and deleting sensitive transient inputs once processing is complete. This change is needed now because every later transcript library, sharing, and export feature depends on a well-defined processing lifecycle and a privacy-safe retention model.

## What Changes

- Add authenticated meeting submission for audio or video files, with optional notes captured at submission time.
- Make the submission flow use direct browser-to-S3-compatible uploads with short-lived presigned URLs so Heroku-hosted web processes do not proxy large media files.
- Define the asynchronous processing job lifecycle from upload through transcript generation, recap generation, AI-generated transcript title creation, terminal success, and terminal failure.
- Specify that the worker reuses shared media/transcription/summarization code from `libs/audio-recap` instead of invoking the CLI as a subprocess.
- Make the transcript record the durable product resource, with canonical markdown fields for the transcript and recap plus privacy-safe metadata needed for retrieval and future management.
- Require normalization of transcript timestamps back to original media time instead of keeping the current CLI's accelerated-audio timeline.
- Define failure handling, retry rules, and user-visible job status behavior.
- Add strict deletion requirements for uploaded source media and transient notes once processing reaches a terminal state.

## Capabilities

### New Capabilities
- `meeting-import-processing`: Authenticated media submission, optional notes capture, async processing, shared-pipeline execution, transcript generation, recap generation, AI title generation, timestamp normalization, and job status behavior.
- `transcript-data-retention`: Durable transcript record shape, privacy-safe persisted metadata, and strict deletion of source media and transient notes after terminal processing states.

### Modified Capabilities
- None.

## Impact

- `app/` gains the first end-to-end product workflow beyond authentication: submission UI, job-status surfaces, and protected server routes for creation and progress checks.
- The Next.js web runtime and `app/worker` must coordinate presigned upload initiation, queue-backed job execution, retries, terminal cleanup, and transcript persistence.
- Postgres must store transcript records and processing-job state needed for durable ownership and status history.
- Redis-backed job execution becomes part of the main user flow rather than only a platform placeholder.
- `libs/audio-recap` must expose reusable pipeline functions that support web-worker execution, original-time normalization, and privacy-safe markdown generation.
- S3-compatible storage becomes part of the user-facing submission path, using AWS S3 in production and MinIO in local development and CI.
