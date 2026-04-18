## MODIFIED Requirements

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
