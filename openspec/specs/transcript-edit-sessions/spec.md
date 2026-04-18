# transcript-edit-sessions Specification

## Purpose

Defines exclusive markdown edit sessions for transcripts owned by `private-transcript-library`: one active lock per transcript over `transcriptMarkdown` and `recapMarkdown` only, role-gated entry to workspace `member` and `admin` users in the current workspace, same-tab refresh resume within a short reconnection window, approximately one-second debounced autosave that renews the session, a 20-minute expiry from the last successful save, and explicit forced exit with no temporary local draft recovery when the lock is lost. Honors the active-workspace requirement owned by `workspace-archival-lifecycle` for entry, resume, and autosave eligibility, but does not re-own archive-triggered lock release or autosave rejection. Metadata-only transcript actions and edits to fields other than `transcriptMarkdown` and `recapMarkdown` are out of scope for this capability.

## Requirements

### Requirement: Only workspace members and admins can acquire a markdown edit session
The system SHALL allow transcript markdown edit-session acquisition only for users with workspace role `member` or `admin` in the current workspace. For workspace-scoped private edit routes, the current workspace SHALL be resolved from the explicit workspace route context defined by `add-workspace-foundation`, and session or remembered workspace state MUST NOT override that explicit route context. The system MUST refuse edit-session acquisition for `read_only` users. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, and this surface MUST honor that active-workspace requirement when edit mode is requested.

#### Scenario: Member or admin enters markdown edit mode
- **WHEN** a workspace `member` or `admin` requests markdown edit mode for a transcript in the current workspace and no other active markdown edit session exists
- **THEN** the system grants the markdown edit session

#### Scenario: Read-only user attempts to enter markdown edit mode
- **WHEN** a workspace `read_only` user requests markdown edit mode for a transcript in the current workspace
- **THEN** the system refuses the markdown edit session

### Requirement: Only one active markdown edit session may exist per transcript
The system SHALL allow only one active markdown edit session for a transcript at a time. A same-tab browser refresh MAY resume that existing session under the reconnection rule below, but MUST NOT create a second concurrent session.

#### Scenario: Second user attempts to enter markdown edit mode
- **WHEN** one user already holds the active transcript markdown edit lock and another user tries to enter markdown edit mode for the same transcript
- **THEN** the system refuses the second edit session

#### Scenario: Same user opens a second tab for markdown editing
- **WHEN** a user already holds the active markdown edit lock for a transcript and opens another tab that tries to enter markdown edit mode for the same transcript
- **THEN** the system refuses the second edit session

### Requirement: Same-tab refresh may resume the active edit session briefly
A browser refresh of the same tab SHALL NOT by itself count as a second concurrent edit session. The system SHALL allow the refreshed client to resume its existing markdown edit session for up to 10 seconds after reload only when it presents the same tab-scoped edit-session identity that originally acquired the lock. On successful resume, the editor MUST reload the last successfully saved `transcriptMarkdown` and `recapMarkdown` from the server.

#### Scenario: Same tab refresh resumes the existing edit session
- **WHEN** a user refreshes the same browser tab while holding a valid markdown edit session and the refreshed client reconnects within 10 seconds using the same tab-scoped edit-session identity
- **THEN** the system resumes the existing edit session instead of creating or rejecting a second one, and the editor reloads the last successfully saved markdown state from the server

#### Scenario: Same tab refresh cannot resume the existing edit session
- **WHEN** a user refreshes the same browser tab but the 10-second reconnect window elapses, the lock has been lost or replaced, or the workspace becomes archived before the refreshed client reconnects
- **THEN** the system refuses the session resume, forces the client out of edit mode, and does not restore unsaved local markdown

### Requirement: The markdown edit lock applies only to transcript and recap markdown
The system SHALL scope the transcript edit lock only to `transcriptMarkdown` and `recapMarkdown`. Metadata-only actions MUST NOT require the markdown lock.

#### Scenario: Metadata-only action while another user edits markdown
- **WHEN** one user holds the transcript markdown edit lock and another permitted user performs a metadata-only action such as rename, tags, important toggle, or share-state management
- **THEN** the system processes the metadata-only action without requiring the markdown edit lock

### Requirement: Markdown autosave renews the active edit session
The system SHALL autosave markdown changes after approximately one second of inactivity. Each successful autosave MUST renew the active edit-session lifetime.

#### Scenario: User pauses after editing markdown
- **WHEN** a user changes transcript or recap markdown and then stops typing for about one second while the edit session is still valid
- **THEN** the system saves the markdown changes automatically and renews the edit-session lifetime

### Requirement: Edit sessions expire 20 minutes after the last successful save
The system SHALL expire a transcript markdown edit session 20 minutes after the last successful save.

#### Scenario: User becomes idle after the last successful autosave
- **WHEN** 20 minutes pass after the last successful transcript autosave without another successful save
- **THEN** the system expires the edit session, removes the user from edit mode, redirects the user away from the active editor state, and shows an explicit lock-expired message

### Requirement: Lost edit sessions reject later saves and do not provide temporary local draft recovery
When an edit session is lost or expired, the system MUST reject later markdown saves for that session. The client MUST force exit from edit mode and MUST NOT offer a temporary local draft recovery flow for the unsaved markdown.

#### Scenario: Browser attempts to save after lock loss
- **WHEN** the browser sends a transcript markdown save for an edit session that has expired or been lost
- **THEN** the system rejects the save, forces the client out of edit mode, and does not offer temporary local draft recovery
