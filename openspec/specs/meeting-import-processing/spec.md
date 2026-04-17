# meeting-import-processing Specification

## Purpose

Defines the first end-to-end product workflow on top of `add-workspace-foundation`, `add-workspace-archival-lifecycle`, and `add-meeting-processing-foundation`: accepting one meeting media submission in the current workspace from a user who has transcript-creation access there, turning it into a durable workspace-owned transcript resource through the shared processing platform, and exposing a narrow workspace-scoped post-submit status surface so the submitter can follow accepted work through `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, and a terminal `completed` or `failed` outcome. Database-backed `mediaNormalizationPolicy` reads and browser-side MP3 normalization happen before upload handoff, and bounded automatic retries with generic terminal failure summaries are owned here. Durable transcript library/detail browsing, editing, sharing, curation, and export are explicitly out of scope and belong to downstream capabilities such as `add-transcript-management`.

## Requirements

### Requirement: Verified authenticated users with transcript-creation access can submit one meeting media file with optional notes in the current workspace
The system SHALL allow a verified authenticated user to submit exactly one audio or video file for processing in the current workspace when that user has transcript-creation access there. For workspace-scoped private submission and status surfaces, the current workspace SHALL be resolved from the explicit workspace route context defined by `add-workspace-foundation`, and session or remembered workspace state MUST NOT override that explicit route context. The submission flow SHALL also allow optional meeting notes captured at submission time as plain text or markdown text. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, and this submission surface MUST honor that active-workspace requirement. The system MUST reject unauthenticated or unverified requests, MUST reject submissions from users who do not have transcript-creation access in the current workspace, MUST reject submissions whose media cannot be validated as supported audio/video input, and MUST reject submissions that exceed configured upload limits before enqueueing background work.

#### Scenario: Successful submission with optional notes
- **WHEN** a verified authenticated user with transcript-creation access submits one valid audio or video file with notes text in the current workspace
- **THEN** the system creates a workspace-owned transcript record with creator attribution, stores the media and notes as transient processing inputs, creates a queued processing job, and returns the transcript identifier and initial processing status

#### Scenario: Successful submission without notes
- **WHEN** a verified authenticated user with transcript-creation access submits one valid audio or video file without notes text in the current workspace
- **THEN** the system creates a workspace-owned transcript record and queued processing job without requiring notes

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
The submission flow SHALL use browser-side normalization before upload handoff. For audio file selections, the browser SHALL try to convert the selected audio into MP3. For video file selections, the browser SHALL try to extract the primary audio track and convert that extracted audio into MP3. If the current normalization policy is `optional`, the system SHALL still allow upload of the original validated file when local normalization is unavailable, unsupported for the selected file, or fails. If the current normalization policy is `required`, the system SHALL reject the submission before queueing when local normalization is unavailable, unsupported for the selected file, or fails. Raw video upload MUST remain supported as a fallback path only while the current policy is `optional`.

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

### Requirement: Meeting processing runs asynchronously with visible status stages through a narrow post-submit status surface
The system SHALL process accepted submissions asynchronously rather than inside the upload request. Each transcript record SHALL expose a user-visible processing status that reflects the current lifecycle stage through a narrow workspace-scoped status surface tied to that transcript's current workspace. This requirement covers only the post-submit status behavior needed to follow accepted work and does not define the durable transcript library/detail read contract, which is owned by `add-transcript-management`. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, and this narrow status surface MUST honor that active-workspace requirement. The status model MUST support `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, and `failed`.

#### Scenario: User checks an in-progress transcript
- **WHEN** a user with read access in the transcript's current workspace requests the post-submit status of a transcript whose job is still running
- **THEN** the system returns the transcript record with its current processing status and without completed markdown fields

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
