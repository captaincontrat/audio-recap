# meeting-import-processing Specification

## Purpose

Defines the first end-to-end product workflow on top of `add-workspace-foundation`, `add-workspace-archival-lifecycle`, and `add-meeting-processing-foundation`: accepting one meeting media submission in the current workspace from a user who has transcript-creation access there — whether from the dedicated submission surface or from the shared workspace shell's workspace-scoped upload entry points — turning it into a durable workspace-owned transcript resource through the shared processing platform, and exposing workspace-scoped post-submit status surfaces (the dedicated transcript status surface and the shared shell's persistent upload manager) so the submitter can follow accepted work through `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, and a terminal `completed` or `failed` outcome. Database-backed `mediaNormalizationPolicy` reads and browser-side MP3 normalization happen before upload handoff, and bounded automatic retries with generic terminal failure summaries are owned here. Durable transcript library/detail browsing, editing, sharing, curation, and export are explicitly out of scope and belong to downstream capabilities such as `add-transcript-management`.
## Requirements
### Requirement: Verified authenticated users with transcript-creation access can submit one meeting media file with optional notes in the current workspace
The system SHALL allow a verified authenticated user to submit exactly one audio or video file for processing in the current workspace when that user has transcript-creation access there. Submission MAY begin from the dedicated workspace submission surface or from the shared workspace shell's workspace-scoped upload entry points, which include the global drag-and-drop affordance and the explicit header upload control. For workspace-scoped private submission and status surfaces, the current workspace SHALL be resolved from the explicit workspace route context defined by `add-workspace-foundation`, and session or remembered workspace state MUST NOT override that explicit route context. The submission flow SHALL also allow optional meeting notes captured at submission time as plain text or markdown text. When submission begins from any shell-level upload entry point, the system MUST associate the file with the current workspace, MUST present a confirmation handoff before upload starts, MUST allow optional notes capture in that handoff, and MUST NOT upload or queue transcript work until the user explicitly confirms. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, and this submission surface MUST honor that active-workspace requirement. The system MUST reject unauthenticated or unverified requests, MUST reject submissions from users who do not have transcript-creation access in the current workspace, MUST reject submissions whose media cannot be validated as supported audio/video input, and MUST reject submissions that exceed configured upload limits before enqueueing background work.

#### Scenario: Successful submission with optional notes
- **WHEN** a verified authenticated user with transcript-creation access submits one valid audio or video file with notes text in the current workspace
- **THEN** the system creates a workspace-owned transcript record with creator attribution, stores the media and notes as transient processing inputs, creates a queued processing job, and returns the transcript identifier and initial processing status

#### Scenario: Successful submission without notes
- **WHEN** a verified authenticated user with transcript-creation access submits one valid audio or video file without notes text in the current workspace
- **THEN** the system creates a workspace-owned transcript record and queued processing job without requiring notes

#### Scenario: Successful submission from the global drop handoff
- **WHEN** a verified authenticated user with transcript-creation access drops one valid audio or video file into the shared shell for the current workspace, reviews the confirmation handoff, and confirms submission
- **THEN** the system uploads and queues that file for the current workspace using the same transcript-creation and processing contract as the dedicated submission surface

#### Scenario: Successful submission from the shell header upload control
- **WHEN** a verified authenticated user with transcript-creation access activates the shell header upload control for the current workspace, selects one valid audio or video file, reviews the confirmation handoff, and confirms submission
- **THEN** the system uploads and queues that file for the current workspace using the same transcript-creation and processing contract as the dedicated submission surface

#### Scenario: User cancels the shell upload handoff before queueing
- **WHEN** a verified authenticated user opens a shell upload handoff for the current workspace but cancels it before confirming
- **THEN** the system does not upload the file and does not create queued transcript work

#### Scenario: Submission is rejected for a read-only workspace member
- **WHEN** a verified authenticated user with only read access in the current workspace attempts to submit meeting media
- **THEN** the system rejects the request and does not create a transcript record or queued processing job

#### Scenario: Submission is rejected before queueing
- **WHEN** a user with transcript-creation access submits an unreadable, unsupported, or oversized media file
- **THEN** the system rejects the request without creating queued background work

#### Scenario: Submission is rejected for an archived workspace
- **WHEN** a verified authenticated user with transcript-creation access attempts to submit meeting media in a current workspace that is archived
- **THEN** the system rejects the request and does not create a transcript record or queued processing job

### Requirement: Media normalization policy is database-backed and governs submission intake
The system SHALL store a Postgres-backed `mediaNormalizationPolicy` setting with allowed values `optional` and `required`. The submission flow SHALL read the current policy from the database before upload intake and SHALL snapshot that policy onto each accepted submission so later policy changes affect only new submissions.

#### Scenario: Optional normalization policy is active
- **WHEN** the current database-backed `mediaNormalizationPolicy` is `optional`
- **THEN** the submission flow allows browser-side normalization to fall back to the original validated file

#### Scenario: Required normalization policy is active
- **WHEN** the current database-backed `mediaNormalizationPolicy` is `required`
- **THEN** the submission flow requires successful browser-side normalization before queueing and does not allow fallback to the original file

### Requirement: The submission flow applies the current normalization policy before upload handoff
The submission flow SHALL use browser-side normalization before upload handoff. For audio file selections, the browser SHALL try to convert the selected audio into MP3. For video file selections, the browser SHALL try to extract the primary audio track and convert that extracted audio into MP3. If the current normalization policy is `optional`, the system SHALL still allow upload of the original validated file when local normalization is unavailable, unsupported for the selected file, or fails. If the current normalization policy is `required`, the system SHALL reject the submission before queueing when local normalization is unavailable, unsupported for the selected file, or fails. Raw video upload MUST remain supported as a fallback path only while the current policy is `optional`. The submission flow SHALL genuinely attempt browser-side MP3 conversion on browsers that support it rather than reporting normalization as unavailable without attempting it. While browser-side normalization is in progress, the client SHALL expose an explicit local normalization state distinct from the later server-side transcript-processing lifecycle, SHALL show conversion progress when the browser runtime provides it, and SHALL keep the submission UI responsive. User-initiated cancellation before upload starts MUST abort the local conversion attempt, MUST NOT upload either the original or derivative file, MUST NOT create queued transcript work, and MUST NOT be presented to the user as a failed submission.

#### Scenario: Audio normalization succeeds before upload
- **WHEN** a verified authenticated user selects a supported audio file and browser-side MP3 conversion succeeds
- **THEN** the browser hands off an MP3 processing input and the system still creates the transcript record and queued processing job

#### Scenario: Video audio extraction succeeds before upload
- **WHEN** a verified authenticated user selects a supported video file and browser-side audio extraction plus MP3 conversion succeeds
- **THEN** the browser hands off the extracted-audio MP3 and the system still creates the transcript record and queued processing job

#### Scenario: Optional mode falls back to the original file
- **WHEN** browser-side normalization is unavailable, unsupported for the selected media, or fails while the current policy is `optional`
- **THEN** the system uploads the original validated audio or video file and continues the submission flow

#### Scenario: Required mode rejects failed normalization
- **WHEN** browser-side normalization is unavailable, unsupported for the selected media, or fails while the current policy is `required`
- **THEN** the system rejects the submission before queueing and does not upload the original file as a fallback

#### Scenario: Browser-side normalization is genuinely attempted on supported browsers
- **WHEN** a verified authenticated user selects a supported audio or video file in a browser that can run browser-side MP3 normalization
- **THEN** the submission flow actually performs the conversion attempt before upload and reports `succeeded` or `failed` based on the real outcome rather than reporting `unavailable` without attempting conversion

#### Scenario: Browser-side normalization is surfaced explicitly while it runs
- **WHEN** browser-side normalization takes long enough to be user-visible during a submission
- **THEN** the submission UI shows that local normalization is in progress and surfaces conversion progress when the browser runtime provides it instead of only showing a generic preparation state

#### Scenario: User cancels browser-side normalization before upload starts
- **WHEN** a user cancels the submission while browser-side normalization is still in progress and before the upload begins
- **THEN** the system aborts the local conversion attempt, does not upload a file, does not create queued transcript work, and returns the submission surface to a non-error state

#### Scenario: Submission UI stays responsive while normalization runs
- **WHEN** browser-side normalization is in progress for a selected file during a submission
- **THEN** the dedicated submission form and the shared workspace shell upload manager remain interactive (the user can still navigate, scroll, edit notes, and cancel) while the conversion completes

### Requirement: Meeting processing runs asynchronously with visible status stages through a narrow post-submit status surface
The system SHALL process accepted submissions asynchronously rather than inside the upload request. Each transcript record SHALL expose a user-visible processing status that reflects the current lifecycle stage through workspace-scoped private follow-up surfaces tied to that transcript's current workspace, including the dedicated transcript status surface and the shared shell's persistent upload manager. This requirement covers only the post-submit status behavior needed to follow accepted work and does not define the durable transcript library/detail read contract, which is owned by `add-transcript-management`. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, and these private follow-up surfaces MUST honor that active-workspace requirement. The status model MUST support `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, and `failed`.

#### Scenario: User checks an in-progress transcript on the dedicated status surface
- **WHEN** a user with read access in the transcript's current workspace requests the dedicated post-submit status surface for a transcript whose job is still running
- **THEN** the system returns the transcript record with its current processing status and without completed markdown fields

#### Scenario: User sees an in-progress transcript in the shell upload manager
- **WHEN** a user queues transcript work from the current workspace shell and the transcript remains non-terminal
- **THEN** the shared shell's upload manager shows the transcript's current processing status using the same lifecycle vocabulary as the dedicated status surface

#### Scenario: Shell upload manager rehydrates non-terminal transcripts for the workspace
- **WHEN** a user with read access opens the shared shell for workspace `w/[slug]` and that workspace already has one or more non-terminal transcripts the user can read
- **THEN** the shared shell's upload manager shows those transcripts with their current processing status using the same lifecycle vocabulary as the dedicated status surface, without requiring a new shell submission

#### Scenario: Shell upload manager remains available during same-workspace navigation
- **WHEN** a user queues transcript work from the current workspace shell and then navigates to another private route in that same workspace while processing is still in progress
- **THEN** the shell continues showing the transcript's current processing status for that workspace

#### Scenario: Status read stays scoped to the transcript workspace
- **WHEN** a user requests post-submit status for a transcript outside the current workspace or without read access there
- **THEN** the system does not expose the transcript status through this surface

#### Scenario: Status read is refused for an archived workspace
- **WHEN** a user requests post-submit status for a transcript whose current workspace is archived
- **THEN** the system refuses active workspace-private access for that archived workspace

#### Scenario: Processing reaches completion
- **WHEN** the worker finishes transcript generation, recap generation, title generation, persistence, and cleanup
- **THEN** the transcript record moves to `completed` status

#### Scenario: Processing reaches terminal failure
- **WHEN** the worker exhausts processing for a submission without a successful completion
- **THEN** the transcript record moves to `failed` status with a generic failure summary suitable for user display

### Requirement: Successful processing produces transcript markdown, recap markdown, and an AI-generated title
For a successful submission, the system SHALL persist a transcript, a meeting recap, and an AI-generated title for the transcript record. The recap generation SHALL use submitted notes when notes were provided and SHALL fall back to transcript-only generation when notes were not provided. The completed transcript record MUST include non-empty canonical markdown fields for both transcript and recap and a non-empty title.

#### Scenario: Successful processing with notes
- **WHEN** a submission with notes reaches successful completion
- **THEN** the completed transcript record contains transcript markdown, recap markdown informed by the provided notes and transcript, and an AI-generated title

#### Scenario: Successful processing without notes
- **WHEN** a submission without notes reaches successful completion
- **THEN** the completed transcript record contains transcript markdown, recap markdown derived from the transcript alone, and an AI-generated title

### Requirement: Retryable failures are retried automatically and non-retryable failures fail fast
The system SHALL automatically retry retryable infrastructure or provider failures up to a bounded maximum of three total attempts for the same transcript record. Non-retryable validation failures MUST NOT be retried. During automatic retry, the transcript status SHALL enter `retrying`, and after the retry budget is exhausted the transcript SHALL move to `failed`.

#### Scenario: Retryable transcription failure
- **WHEN** a processing attempt fails because of a retryable provider or infrastructure error
- **THEN** the system records retrying status, schedules another attempt for the same transcript record, and does not create a duplicate transcript record

#### Scenario: Retry budget is exhausted
- **WHEN** retryable processing continues to fail until the final allowed attempt is exhausted
- **THEN** the system marks the transcript record as `failed` with a generic failure summary

#### Scenario: Validation failure is non-retryable
- **WHEN** processing fails because the submission cannot be validated as usable meeting media
- **THEN** the system fails the transcript without automatic retry

