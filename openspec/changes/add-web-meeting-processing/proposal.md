## Why

The reduced platform bootstrap now defines the verified-user foundation, runtime topology, and queue/database baseline, and `add-meeting-processing-foundation` now defines the shared transient-storage and library-first processing contracts that make web-safe meeting processing possible.

What the product still needs is the first end-to-end user workflow on top of those foundations: accepting one meeting media submission, turning it into a durable transcript resource with a stable processing lifecycle, and deleting sensitive transient inputs once processing reaches a terminal state. This reduced change exists to define that transcript/job lifecycle contract without also carrying the lower-level storage and pipeline-refactor scope.

## What Changes

- Add authenticated meeting submission for one audio or video file with optional notes captured at submission time.
- Create the durable transcript resource immediately on accepted submission, along with a separate processing-job record that tracks execution state and retry history.
- Make submission intake read the database-backed `mediaNormalizationPolicy`, apply the current browser-side normalization rules, and snapshot the policy onto each accepted job.
- Define the asynchronous processing lifecycle from `queued` through terminal success or failure, including user-visible status stages and bounded retry behavior.
- Persist completed transcript records with canonical `transcriptMarkdown`, `recapMarkdown`, an AI-generated title, and privacy-safe metadata needed for later management features.
- Require deletion of transient source media and transient notes before a transcript is published as `completed` or `failed`.

## Capabilities

### New Capabilities
- `meeting-import-processing`: Authenticated media submission, optional notes capture, async processing lifecycle, transcript/job status behavior, and durable transcript completion.
- `transcript-data-retention`: Durable transcript record shape, privacy-safe persisted metadata, and strict deletion of source media and transient notes after terminal processing states.

### Modified Capabilities
- None.

## Impact

- `app/` gains the first end-to-end authenticated meeting-submission workflow, including transcript creation and status surfaces.
- Postgres becomes the durable home for transcript records, processing-job state, normalization-policy snapshots, and privacy-safe transcript metadata.
- `app/worker` coordinates transcript persistence, retries, failure handling, and cleanup on top of the shared storage and processing contracts from `add-meeting-processing-foundation`.
- Later transcript management, sharing, and export changes build on the reduced transcript resource contract defined here rather than on storage or pipeline-internals artifacts.
