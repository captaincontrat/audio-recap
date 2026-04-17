## Context

The platform bootstrap now establishes the web runtime, worker entrypoint, Postgres, Redis, and verified-user authentication foundation. `add-meeting-processing-foundation` now carries the shared transient-storage contract, direct-upload contract, and library-first processing helpers that were making this change too large. `add-workspace-foundation` now carries the workspace, membership-role, and current-workspace contract that transcript-focused changes need to build on.

This reduced change focuses on the product contract that later transcript-management and sharing work actually needs: a verified user with transcript-creation access in the current workspace submits one meeting media file and optional notes, the system creates a durable workspace-owned transcript resource plus a processing job, the worker drives that resource through a visible lifecycle and narrow post-submit status surface, and the system guarantees that transient media and notes are deleted before the transcript reaches a terminal state.

## Goals / Non-Goals

**Goals:**

- Define the authenticated submission workflow for one audio or video file plus optional notes in the current workspace.
- Require transcript-creation access in the current workspace for submission.
- Define the durable transcript record and the processing-job record that tracks lifecycle execution.
- Define a database-backed `mediaNormalizationPolicy` and require the accepted submission to snapshot the current policy.
- Specify user-visible processing stages, bounded retry behavior, and terminal failure behavior.
- Define the durable transcript completion contract: canonical transcript markdown, canonical recap markdown, AI-generated title, creator attribution that can survive later creator-account deletion without changing workspace ownership, and privacy-safe metadata.
- Guarantee deletion of transient source media and transient notes before terminal transcript states are published.

**Non-Goals:**

- Re-defining the S3-compatible storage contract, MinIO parity rules, or presigned-upload CORS details already owned by `add-meeting-processing-foundation`.
- Re-defining the shared `libs/audio-recap` processing modules, privacy-safe rendering helpers, or timestamp-normalization implementation already owned by `add-meeting-processing-foundation`.
- Transcript library organization, durable transcript library/detail reading, transcript editing, public sharing, or export behavior.
- Workspace invitation flows, workspace archival behavior, or transcript edit-session behavior.
- Long-term retention of source media or raw notes.

## Decisions

### Decision: Create the transcript resource immediately in the current workspace, then track execution in a separate processing-job record

Each accepted submission in the current workspace creates two durable Postgres records:

- a `transcript` record, which is the long-lived product resource
- a `processing_job` record, which tracks attempts, stages, policy snapshot, and transient execution references

The transcript exists from submission time onward so the current workspace has a stable resource to follow through narrow post-submit status behavior and later hand off to broader transcript-management read surfaces. The processing job is owned by that transcript and keeps the transient execution state out of the durable product model.

**Why this over alternatives**

- Over creating the transcript only on success: users would have no stable object for status polling or failed-attempt visibility.
- Over storing all execution state directly on the transcript row: a dedicated job record gives cleaner retry bookkeeping and keeps the durable resource narrower.

### Decision: Use the current workspace route context and membership role model for submission authorization

Submission is scoped to one current workspace resolved by the shared workspace-context contract from `add-workspace-foundation`. For workspace-scoped private submission and status surfaces, the explicit workspace route context is authoritative; session or remembered state may help choose a default entry route when no workspace is explicit, but must not override the route-selected workspace.

`add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, so this change's submission and narrow status surfaces must honor that active-workspace requirement without redefining archive policy here.

Authorization rules for this reduced change:

- `member` can submit a transcript in the current workspace
- `admin` can submit a transcript in the current workspace
- `read_only` cannot submit a transcript in the current workspace

This keeps transcript creation aligned with the workspace ownership model without pulling invitation, archival, or workspace-selection UX details into this change.

**Why this over alternatives**

- Over keeping submission implicitly owner-scoped: that would harden the wrong durable ownership model before collaboration lands.
- Over allowing any workspace reader to submit: it would erase the distinction between read access and transcript-creation access in the workspace role model.

### Decision: Keep transient media and notes outside Postgres, with opaque references stored on the job record

Uploaded media and optional notes remain transient processing inputs rather than durable product content. This change therefore requires:

- transient inputs are stored outside Postgres using the shared storage contract from `add-meeting-processing-foundation`
- the processing job stores only opaque references to those transient inputs
- the durable transcript record never stores raw notes, raw source media, object keys, original filenames, or filesystem paths

This change owns the lifecycle and retention rules around those references, while the lower-level storage implementation details remain with the foundation change.

**Why this over alternatives**

- Over storing media or notes in Postgres: large blobs and raw notes do not belong in the durable system of record.
- Over letting the storage layer define retention semantics: cleanup ordering is a product-level lifecycle guarantee, not just a storage concern.

### Decision: Use a database-backed normalization policy and snapshot it onto each accepted submission

Before upload handoff begins, the web runtime reads the Postgres-backed `mediaNormalizationPolicy` with allowed values `optional` and `required`.

For each accepted submission:

- audio selections try browser-side MP3 conversion
- video selections try browser-side primary-audio extraction plus MP3 conversion
- `optional` mode allows fallback to the original validated file when normalization is unavailable or fails
- `required` mode rejects the submission before queueing when normalization is unavailable or fails
- the accepted submission snapshots the current policy onto the processing job so later policy changes affect only new submissions

The foundation change defines the shared processing/storage contracts consumed after intake; this change owns the product rule for when a submission is accepted or rejected.

**Why this over alternatives**

- Over a deploy-time toggle: a database-backed setting lets operators change intake strictness without redeploying.
- Over re-reading the latest policy during later processing: snapshotting keeps in-flight submissions stable.

### Decision: Persist a privacy-minimal durable transcript resource

Successful processing persists canonical content and a small metadata set needed by later product features:

- `transcriptMarkdown`
- `recapMarkdown`
- generated title
- `workspaceId`
- `createdByUserId` while the creator account exists
- processing status
- source media kind
- original media duration
- `submittedWithNotes`
- created, updated, and completed timestamps
- generic failure code and generic failure summary for terminal failures

Later account-lifecycle work may permanently delete the creator account while leaving the transcript in its workspace. In that case, the creator reference may be cleared without changing workspace ownership.

This change consumes the shared title/rendering/timestamp helpers from `add-meeting-processing-foundation`, but it owns the durable resource contract that later workspace-scoped transcript management, sharing, and export changes build on. The durable transcript library/detail read surface itself is owned separately by `add-transcript-management`.

**Why this over alternatives**

- Over persisting more submission metadata for convenience: the product favors privacy-minimal retention over richer debugging residue.
- Over delaying the durable content contract to later management work: downstream changes need a stable transcript resource defined here.
- Over requiring transcript lifetime to match creator-account lifetime: that would fight the workspace-owned collaboration model this change depends on.

### Decision: Expose explicit lifecycle stages and bounded automatic retries through a narrow workspace-scoped status surface

The transcript lifecycle exposes these user-visible stages through a narrow post-submit status surface scoped by the transcript's workspace:

- `queued`
- `preprocessing`
- `transcribing`
- `generating_recap`
- `generating_title`
- `finalizing`
- `retrying`
- `completed`
- `failed`

Users with read access in the current workspace can poll or reopen this narrow status surface while the job is in progress or terminal. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, so this status surface depends on that active-workspace gate. `add-transcript-management` separately owns the durable transcript library and detail read surfaces built on the same resource, but this reduced change's status behavior must already follow workspace scoping rather than owner-only semantics.

Retry behavior:

- validation failures are non-retryable and fail immediately
- retryable provider or infrastructure failures are retried automatically up to three total attempts
- retries keep the same transcript record
- after the retry budget is exhausted, the transcript becomes terminally failed with a generic failure summary

**Why this over alternatives**

- Over a single boolean status: users need meaningful progress and failure visibility for a multi-stage pipeline.
- Over unbounded retries: they hide stuck work and make cleanup guarantees harder to reason about.
- Over owner-only status polling: that would harden the wrong read model for a workspace-owned transcript resource.

### Decision: Publish terminal states only after transient cleanup completes

The worker finalization order is:

1. persist the successful content or generic failure summary with `finalizing` status
2. delete transient media and transient notes referenced by the job
3. update the transcript to `completed` or `failed`

This is the core retention guarantee of the reduced change: once a user sees `completed` or `failed`, the transient source inputs are already gone.

If cleanup fails, the transcript remains non-terminal until the system completes cleanup or otherwise satisfies the deletion contract before publishing the terminal state.

**Why this over alternatives**

- Over marking the transcript terminal before cleanup: that would break the privacy guarantee that source inputs are gone once terminal states are visible.

## Risks / Trade-offs

- [Failed transcripts will persist as durable rows] -> Keep them privacy-minimal and store only generic failure data.
- [Policy changes can happen while users are mid-submission] -> Snapshot the policy onto accepted jobs and apply changes only to new submissions.
- [This change now depends on both workspace and processing foundations] -> Reuse `add-workspace-foundation` for current-workspace resolution and role semantics, and cross-reference `add-meeting-processing-foundation` where storage and canonical-output contracts are consumed rather than duplicated.
- [Cleanup-before-terminal-state can delay visible completion] -> Keep cleanup explicit, idempotent, and part of the worker finalization stage rather than mixing it into content-generation stages.

## Migration Plan

1. Depend on `add-workspace-foundation` for current-workspace resolution, membership roles, and workspace-owned transcript semantics, on `add-workspace-archival-lifecycle` for active-workspace gating, and on `add-meeting-processing-foundation` for shared transient storage and importable processing outputs.
2. Define the transcript and processing-job schema plus `workspaceId`, creator attribution via `createdByUserId` while the account exists, and the normalization-policy snapshot behavior.
3. Define submission acceptance, workspace-role enforcement, queue handoff, the narrow transcript-status surface, retries, and terminal failure behavior.
4. Persist completed transcripts and enforce cleanup-before-terminal guarantees for transient media and notes.
5. Layer transcript management, sharing, and export changes on top of the resulting transcript resource model.

Rollback strategy:

- keep the transcript resource model narrower than the full storage/pipeline implementation details
- disable the submission path if the worker lifecycle is unstable
- preserve already-created transcript records in Postgres even if processing intake is paused

## Open Questions

None are blocking for this reduced change. Workspace selection, invitation, and archival details now live with `add-workspace-foundation` or later workspace changes, while later product changes will define transcript management, public sharing, and export behavior on top of the contract defined here.
