## ADDED Requirements

### Requirement: The shell exposes workspace-scoped upload entry points with confirmation before queueing
The shared workspace shell SHALL expose workspace-scoped upload entry points for meeting media in the current workspace. The shell MUST support a global drag-and-drop target anywhere inside the shared shell and an explicit header-level upload control. Both entry points MUST open the same drop-then-confirm handoff associated with the current workspace. While a user drags a supported file over the shared shell, the system MUST show a current-workspace drop overlay that identifies the target workspace. Dropping the file or activating the header upload control MUST open the confirmation handoff and MUST allow the user to review the file and optionally add notes before any upload begins. The system MUST NOT upload media or queue transcript processing until the user explicitly confirms the handoff. Users without transcript-creation access in the current workspace MUST NOT receive an accepting drop target and MUST NOT see an active header upload control, and archived workspaces MUST NOT accept queueable shell submissions.

#### Scenario: Supported file drag opens the current-workspace confirmation handoff
- **WHEN** a user with transcript-creation access drags and drops one supported meeting file anywhere inside the shared shell for workspace `w/[slug]`
- **THEN** the system shows a drop overlay that identifies `w/[slug]` as the target workspace and opens a confirmation handoff associated with `w/[slug]` before upload starts

#### Scenario: Header upload control opens the same confirmation handoff
- **WHEN** a user with transcript-creation access activates the shell's header upload control in workspace `w/[slug]`
- **THEN** the system opens the same drop-then-confirm handoff associated with `w/[slug]` that a file drop would have opened

#### Scenario: User cancels the drop handoff
- **WHEN** a user drops a supported file into the shared shell but cancels the confirmation handoff
- **THEN** the system does not upload the file and does not create queued transcript work

#### Scenario: Read-only user cannot queue work from the shell
- **WHEN** a user without transcript-creation access in the current workspace drags a file over the shared shell or looks at the shell header
- **THEN** the shell does not accept the drop as a queueable transcript submission for that workspace and does not present an active header upload control

#### Scenario: Archived workspace does not accept shell-level submission
- **WHEN** a user with transcript-creation access drags a file over the shared shell or looks at the shell header in a current workspace that is archived
- **THEN** the shell does not accept the drop as a queueable transcript submission and does not present an active header upload control

### Requirement: The shell hosts a persistent workspace-scoped upload manager
The shared workspace shell SHALL host a persistent floating upload manager scoped to the current workspace. The upload manager MUST show shell-level submissions from their local submission phases through the transcript-processing lifecycle once queueing succeeds, using the same lifecycle vocabulary defined by `meeting-import-processing` (`queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, `failed`). The upload manager MUST also rehydrate its visible queue from the workspace's non-terminal transcripts when the shell mounts, so in-progress work survives page reloads and navigation back into the workspace. The upload manager MUST support multiple concurrent items in the same current workspace and MUST remain scoped so one workspace's in-flight submissions are never shown while the user is viewing another workspace. Each non-draft item MUST offer a route into the transcript's dedicated private status or detail surface when that resource becomes available. Terminal items MAY be dismissed by the user from the upload manager, and the upload manager MUST keep failed items visible for the current workspace session until the user dismisses them. Dismissal MUST be client-only and MUST NOT delete the underlying transcript record.

#### Scenario: Accepted shell submission appears in the upload manager
- **WHEN** a user confirms a shell-level meeting submission in the current workspace
- **THEN** the upload manager shows that submission's local progress and continues showing the transcript-processing lifecycle after queueing succeeds

#### Scenario: Upload manager rehydrates in-progress work from the workspace
- **WHEN** a user opens the shared shell for workspace `w/[slug]` and that workspace has one or more non-terminal transcripts the user can read
- **THEN** the upload manager shows those transcripts with their current processing status without requiring a new shell submission

#### Scenario: Upload manager merges rehydrated and in-session items by transcript id
- **WHEN** a shell-level submission in workspace `w/[slug]` reaches queued state during the session and the shell then rehydrates non-terminal transcripts for `w/[slug]`
- **THEN** the upload manager shows exactly one item for that transcript, merging the in-session item and the rehydrated item by transcript id

#### Scenario: Upload manager shows multiple concurrent submissions
- **WHEN** a user has more than one shell submission in the current workspace that has not yet reached a terminal state
- **THEN** the upload manager shows each submission as its own item with its own current state

#### Scenario: Upload manager persists across same-workspace navigation
- **WHEN** a user starts a shell-level submission in workspace `w/[slug]` and then navigates to another private route in the same workspace
- **THEN** the upload manager remains visible for `w/[slug]` and preserves the submission's current state

#### Scenario: Upload manager does not leak cross-workspace activity
- **WHEN** a user starts a shell-level submission in workspace `w/[slug-a]` and then opens a private route in workspace `w/[slug-b]`
- **THEN** the shared shell for `w/[slug-b]` does not show the in-flight upload-manager item from `w/[slug-a]`

#### Scenario: User dismisses a terminal item
- **WHEN** a user dismisses a terminal upload-manager item in the current workspace
- **THEN** the upload manager removes that item from the visible queue for that workspace without changing the underlying transcript record

#### Scenario: Failed items remain pinned until dismissed
- **WHEN** a shell-level submission in the current workspace reaches a terminal failed state and the user has not yet dismissed the item
- **THEN** the upload manager keeps the failed item visible for the current workspace session
