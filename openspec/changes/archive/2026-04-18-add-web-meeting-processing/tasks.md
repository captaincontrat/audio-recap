## 1. Submission And Durable Resource Creation

- [x] 1.1 Add the Postgres schema and migrations for transcript records and processing-job records using workspace ownership from `add-workspace-foundation`, including `workspaceId`, creator attribution via `createdByUserId` while the creator account exists, support for later nulling that reference after account deletion, a database-backed `mediaNormalizationPolicy` setting, policy snapshots captured on accepted submissions, processing statuses, generic failure fields, and privacy-safe transcript metadata.
- [x] 1.2 Implement the authenticated submission acceptance flow in the Next.js web runtime that resolves the current workspace, enforces transcript-creation access for `member` and `admin` users, validates one audio/video file plus optional notes, reads the current database-backed normalization policy, coordinates with the foundation-backed upload handoff, creates the transcript and processing-job records, and enqueues the job once the transient-input handoff succeeds.

## 2. Worker Lifecycle And Retention

- [x] 2.1 Implement worker execution for the `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, and `finalizing` stages using the shared processing outputs from `add-meeting-processing-foundation`.
- [x] 2.2 Implement retry classification, bounded automatic retries, `retrying` status updates, and generic terminal failure summaries without creating duplicate transcript records.
- [x] 2.3 Implement terminal cleanup ordering so transient media and transient notes are deleted before a transcript is marked `completed` or `failed`.

## 3. App And API Status Surfaces

- [x] 3.1 Build the protected web submission flow in `app/` for one audio/video file plus optional notes, including active-workspace gating, pre-queue validation feedback, database-backed normalization-policy handling, foundation-backed upload handoff, and clear rejection UX when `required`-mode normalization cannot complete.
- [x] 3.2 Add a narrow transcript-status endpoint or protected post-submit status page that lets current-workspace users with read access poll and display queued, in-progress, retrying, completed, and failed states from the transcript record without taking ownership of the broader durable library/detail read surfaces.
- [x] 3.3 Render the post-submit status experience from transcript processing state, generic failure summaries, and completion handoff data rather than from transient input data, deferring durable library/detail browsing to `add-transcript-management`.

## 4. Validation And Regression Coverage

- [x] 4.1 Add automated coverage for transcript/job creation, current-workspace resolution, active-workspace gating, transcript-creation authorization, normalization-policy reads and snapshots, submission acceptance and rejection behavior, and upload-handoff coordination against the shared foundation contracts.
- [x] 4.2 Add automated coverage for worker orchestration, recap/title persistence, retry behavior, and generic failure handling.
- [x] 4.3 Add automated coverage for retention guarantees, including deletion of source media and transient notes before terminal transcript states are published.
