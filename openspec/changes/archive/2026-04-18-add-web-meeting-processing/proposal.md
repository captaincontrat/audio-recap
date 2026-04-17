## Why

The reduced platform bootstrap now defines the verified-user foundation, runtime topology, and queue/database baseline, `add-meeting-processing-foundation` defines the shared transient-storage and library-first processing contracts that make web-safe meeting processing possible, and `add-workspace-foundation` defines workspace as the durable collaboration boundary.

What the product still needs is the first end-to-end user workflow on top of those foundations: accepting one meeting media submission in the current workspace from a user who can create transcripts there, turning it into a durable workspace-owned transcript resource with a stable processing lifecycle and narrow post-submit status behavior, and deleting sensitive transient inputs once processing reaches a terminal state. This reduced change exists to define that submission and transcript/job lifecycle contract without also carrying lower-level storage, workspace-foundation, or later transcript-management read-surface scope.

## What Changes

- Add authenticated meeting submission in the current workspace for one audio or video file with optional notes captured at submission time.
- Require transcript-creation access in the current workspace for submission, using the role model introduced by `add-workspace-foundation`.
- Create the durable transcript resource immediately on accepted submission, along with a separate processing-job record that tracks execution state and retry history.
- Make submission intake read the database-backed `mediaNormalizationPolicy`, apply the current browser-side normalization rules, and snapshot the policy onto each accepted job.
- Define the asynchronous processing lifecycle from `queued` through terminal success or failure, including workspace-scoped status behavior and bounded retry behavior.
- Persist completed transcript records as workspace-owned resources with `workspaceId`, creator attribution via `createdByUserId` while the creator account exists, canonical `transcriptMarkdown`, canonical `recapMarkdown`, an AI-generated title, and privacy-safe metadata needed for later management features.
- Require deletion of transient source media and transient notes before a transcript is published as `completed` or `failed`.

## Capabilities

### New Capabilities
- `meeting-import-processing`: Workspace-scoped media submission, optional notes capture, async processing lifecycle, narrow post-submit status behavior, and durable transcript completion.
- `transcript-data-retention`: Durable workspace-owned transcript record shape, privacy-safe persisted metadata, and strict deletion of source media and transient notes after terminal processing states.

### Modified Capabilities
- None.

## Impact

- `app/` gains the first end-to-end authenticated meeting-submission workflow in the current workspace, including transcript creation and post-submit status surfaces.
- Postgres becomes the durable home for workspace-owned transcript records, processing-job state, normalization-policy snapshots, creator attribution, and privacy-safe transcript metadata.
- The web runtime depends on `add-workspace-foundation` for current-workspace resolution and transcript-creation authorization before intake begins, and on `add-workspace-archival-lifecycle` for the active-workspace requirement that locks archived workspaces out of submission and post-submit status surfaces.
- `app/worker` coordinates transcript persistence, retries, failure handling, and cleanup on top of the shared storage and processing contracts from `add-meeting-processing-foundation`.
- Later transcript-management, sharing, and export changes build on the reduced workspace-owned transcript resource contract defined here, while the durable transcript library/detail read surface itself is owned by `add-transcript-management`.
