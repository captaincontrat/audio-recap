## Split Result

The original `add-web-meeting-processing` scope was split into:

- reduced processing lifecycle change: `openspec/changes/add-web-meeting-processing/`
- new processing foundation change: `openspec/changes/add-meeting-processing-foundation/`

Validation check after the split:

- `openspec validate --changes --json --no-interactive`
- result: 8/8 active changes valid

Context-surface checkpoint after the split:

- reduced `add-web-meeting-processing`: `30 + 162 + 22 + 87 + 41 = 342`
- new `add-meeting-processing-foundation`: `27 + 126 + 16 + 40 = 209`
- no second follow-up change was needed because the reduced processing change is no longer the oversized outlier in the active set

Functional-scope result:

- No original functional requirement was dropped.
- No second intake-specific follow-up was needed after the first split checkpoint.
- The only structural change was introducing the new `meeting-processing-foundation` capability so storage and shared-pipeline work no longer inflate the transcript lifecycle change.

## Proposal Scope Mapping

| Original processing proposal item | Outcome | New home |
| --- | --- | --- |
| Authenticated meeting submission for audio or video files with optional notes | Stays | reduced `add-web-meeting-processing` |
| Direct browser-to-S3-compatible uploads with short-lived presigned URLs | Split | upload-contract and presigned/CORS details move to `add-meeting-processing-foundation`; submission acceptance stays in reduced `add-web-meeting-processing` |
| Concrete S3-compatible transient-input storage contract and shared `libs/audio-recap` pipeline refactor | Moved | `openspec/changes/add-meeting-processing-foundation/` |
| Database-backed `mediaNormalizationPolicy` with `optional` and `required` intake behavior | Stays, narrowed | policy and intake rules stay in reduced `add-web-meeting-processing`; shared processing support for original uploads versus browser-produced MP3 derivatives moves to `add-meeting-processing-foundation` |
| Asynchronous processing lifecycle from upload through transcript, recap, title, and terminal outcome | Stays | reduced `add-web-meeting-processing` |
| Worker reuses shared meeting-processing code from `libs/audio-recap` instead of invoking the CLI | Moved | `add-meeting-processing-foundation` |
| Transcript record is the durable product resource with canonical markdown and privacy-safe metadata | Stays | reduced `add-web-meeting-processing` plus `transcript-data-retention` |
| Transcript timestamps are normalized back to original media time | Moved | `add-meeting-processing-foundation` |
| Failure handling, retry rules, and user-visible job status behavior | Stays | reduced `add-web-meeting-processing` |
| Strict deletion of uploaded source media and transient notes after terminal processing states | Stays | reduced `add-web-meeting-processing` plus `transcript-data-retention` |

## Design Decision Mapping

| Original design decision | Outcome | New home |
| --- | --- | --- |
| Create a transcript record immediately, then drive processing through a separate job record | Stays | reduced `add-web-meeting-processing` |
| Use transient input storage outside Postgres, with references from the job record | Split | job-owned opaque references and transient-lifecycle rules stay in reduced `add-web-meeting-processing`; concrete S3-compatible storage and direct-upload contract move to `add-meeting-processing-foundation` |
| Use a database-backed Mediabunny normalization policy before direct upload | Stays, narrowed | policy ownership and submission acceptance rules stay in reduced `add-web-meeting-processing`; storage and downstream processing-contract details move to `add-meeting-processing-foundation` |
| Processing runs only through shared `libs/audio-recap` modules, not CLI subprocesses | Moved | `add-meeting-processing-foundation` |
| Normalize timestamps to original media time before building canonical markdown | Moved | `add-meeting-processing-foundation` |
| Persist privacy-safe canonical markdown only | Split | durable transcript contract stays in reduced `add-web-meeting-processing`; privacy-safe rendering helper implementation moves to `add-meeting-processing-foundation` |
| Use explicit processing stages and bounded automatic retries | Stays | reduced `add-web-meeting-processing` |
| Terminal states are published only after cleanup of transient inputs | Stays | reduced `add-web-meeting-processing` plus `transcript-data-retention` |
| Generate the title as an explicit worker stage | Split | completed-transcript output contract stays in reduced `add-web-meeting-processing`; shared title-generation helper moves to `add-meeting-processing-foundation` |

## Task Mapping

| Original task | Outcome | New home |
| --- | --- | --- |
| 1.1 Postgres schema and migrations for transcript records, processing jobs, normalization policy, statuses, and privacy-safe metadata | Stays | reduced `add-web-meeting-processing` 1.1 |
| 1.2 Transient S3-compatible input storage abstraction, MinIO local/CI usage, bucket bootstrap, browser-direct `PUT` CORS configuration, and shared create/read/delete operations | Moved | `add-meeting-processing-foundation` 1.1 through 1.3 |
| 1.3 Authenticated submission initiation flow with policy read, presigned upload details, transcript/job creation, and queue handoff | Split | transcript/job creation, policy snapshot, and queue handoff stay in reduced `add-web-meeting-processing` 1.2 and 3.1; presigned upload contract details move to `add-meeting-processing-foundation` 1.2 |
| 2.1 Refactor `libs/audio-recap` into reusable worker-importable pipeline modules | Moved | `add-meeting-processing-foundation` 2.1 |
| 2.2 Shared-library title generation and privacy-safe markdown rendering | Moved | `add-meeting-processing-foundation` 2.2 |
| 2.3 Timestamp normalization helpers for original-media time | Moved | `add-meeting-processing-foundation` 2.3 |
| 3.1 Worker execution for `queued` through `finalizing` | Stays, narrowed | reduced `add-web-meeting-processing` 2.1 consumes the shared outputs from `add-meeting-processing-foundation` |
| 3.2 Retry classification, bounded automatic retries, and generic terminal failure summaries | Stays | reduced `add-web-meeting-processing` 2.2 |
| 3.3 Terminal cleanup ordering before `completed` or `failed` | Stays | reduced `add-web-meeting-processing` 2.3 |
| 4.1 Protected web submission flow with validation, normalization handling, upload path, and rejection UX | Stays, narrowed | reduced `add-web-meeting-processing` 3.1 owns user-facing submission behavior; foundation change owns upload-contract internals |
| 4.2 Transcript-status read surfaces | Stays | reduced `add-web-meeting-processing` 3.2 |
| 4.3 Render completed transcript records from canonical transcript fields and privacy-safe metadata | Stays | reduced `add-web-meeting-processing` 3.3 |
| 5.1 Automated coverage for submission validation, policy snapshots, browser-side normalization behavior, presigned initiation, transcript creation, and transient-input handling | Split | transcript/job creation and upload-handoff coordination move to reduced `add-web-meeting-processing` 4.1; storage parity and presigned-contract coverage move to `add-meeting-processing-foundation` 3.2 |
| 5.2 Automated coverage for worker orchestration, timestamp normalization, recap/title generation, retry behavior, and generic failure handling | Split | orchestration, retry behavior, and generic failure handling stay in reduced `add-web-meeting-processing` 4.2; timestamp normalization plus shared title/render coverage move to `add-meeting-processing-foundation` 3.2 |
| 5.3 Automated coverage for retention guarantees, including deletion before terminal transcript states | Stays | reduced `add-web-meeting-processing` 4.3 |

## Requirement Mapping

| Original requirement | Outcome | New home |
| --- | --- | --- |
| Verified authenticated users can submit one meeting media file with optional notes | Stays | `add-web-meeting-processing/specs/meeting-import-processing/spec.md` |
| Media normalization policy is database-backed and governs submission intake | Stays | `add-web-meeting-processing/specs/meeting-import-processing/spec.md` |
| The submission flow applies the current normalization policy before upload | Stays, narrowed | `add-web-meeting-processing/specs/meeting-import-processing/spec.md` keeps the intake rule; `add-meeting-processing-foundation/specs/meeting-processing-foundation/spec.md` owns the shared upload and processing contracts used after acceptance |
| Meeting processing runs asynchronously with visible status stages | Stays | `add-web-meeting-processing/specs/meeting-import-processing/spec.md` |
| The worker uses shared meeting-processing library code | Moved | `add-meeting-processing-foundation/specs/meeting-processing-foundation/spec.md` |
| Successful processing produces transcript markdown, recap markdown, and an AI-generated title | Stays | `add-web-meeting-processing/specs/meeting-import-processing/spec.md` |
| Transcript timestamps are normalized to original media time | Moved | `add-meeting-processing-foundation/specs/meeting-processing-foundation/spec.md` |
| Retryable failures are retried automatically and non-retryable failures fail fast | Stays | `add-web-meeting-processing/specs/meeting-import-processing/spec.md` |
| The transcript record is the durable product resource | Stays | `add-web-meeting-processing/specs/transcript-data-retention/spec.md` |
| Durable transcript records store only privacy-safe metadata | Stays | `add-web-meeting-processing/specs/transcript-data-retention/spec.md` |
| Source media and transient notes are deleted before terminal states are published | Stays | `add-web-meeting-processing/specs/transcript-data-retention/spec.md` |
| Raw notes are transient processing inputs, not durable content | Stays | `add-web-meeting-processing/specs/transcript-data-retention/spec.md` |

## Reconciliation Verdict

Every meaningful proposal item, design decision, task, and requirement from the preserved `add-web-meeting-processing` snapshot maps to exactly one of these outcomes:

- stays in the reduced `add-web-meeting-processing`
- moves to `add-meeting-processing-foundation`
- or is narrowed in the reduced change while its shared implementation contract moves to `add-meeting-processing-foundation`

No original product requirement was silently dropped in the split, and the checkpoint confirmed that no third follow-up change was necessary after the first extraction.
