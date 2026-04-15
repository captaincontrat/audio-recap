## 1. Submission And Durable Resource Creation

- [ ] 1.1 Add the Postgres schema and migrations for transcript records, processing-job records, a database-backed `mediaNormalizationPolicy` setting, policy snapshots captured on accepted submissions, processing statuses, generic failure fields, and privacy-safe transcript metadata.
- [ ] 1.2 Implement the authenticated submission acceptance flow in the Next.js web runtime that validates one audio/video file plus optional notes, reads the current database-backed normalization policy, coordinates with the foundation-backed upload handoff, creates the transcript and processing-job records, and enqueues the job once the transient-input handoff succeeds.

## 2. Worker Lifecycle And Retention

- [ ] 2.1 Implement worker execution for the `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, and `finalizing` stages using the shared processing outputs from `add-meeting-processing-foundation`.
- [ ] 2.2 Implement retry classification, bounded automatic retries, `retrying` status updates, and generic terminal failure summaries without creating duplicate transcript records.
- [ ] 2.3 Implement terminal cleanup ordering so transient media and transient notes are deleted before a transcript is marked `completed` or `failed`.

## 3. App And API Status Surfaces

- [ ] 3.1 Build the protected web submission flow in `app/` for one audio/video file plus optional notes, including pre-queue validation feedback, database-backed normalization-policy handling, foundation-backed upload handoff, and clear rejection UX when `required`-mode normalization cannot complete.
- [ ] 3.2 Add transcript-status read surfaces that let the browser poll and display queued, in-progress, retrying, completed, and failed states from the transcript record.
- [ ] 3.3 Render completed transcript records from canonical `transcriptMarkdown`, `recapMarkdown`, title, and privacy-safe metadata rather than from transient input data.

## 4. Validation And Regression Coverage

- [ ] 4.1 Add automated coverage for transcript/job creation, normalization-policy reads and snapshots, submission acceptance and rejection behavior, and upload-handoff coordination against the shared foundation contracts.
- [ ] 4.2 Add automated coverage for worker orchestration, recap/title persistence, retry behavior, and generic failure handling.
- [ ] 4.3 Add automated coverage for retention guarantees, including deletion of source media and transient notes before terminal transcript states are published.
