# workspace-archival-lifecycle Specification

## Purpose

Defines the archive-first lifecycle for team workspaces: a workspace can be archived by an admin, restored within a 60-day window, and is permanently deleted only after that window elapses without restoration. This capability owns the cross-cutting shutdown rules that archival triggers — refusal to archive during upload or non-terminal audio-processing work, immediate unavailability of workspace-private transcript surfaces and authenticated export, immediate invalidation of pending invitation links and public share resolution, release of markdown edit locks and refusal of further autosaves and same-tab edit-session resume, and the post-restore requirement that previously enabled public share links stay inactive until fresh share management happens. Personal workspaces are outside this lifecycle and MUST NOT be archived through the normal workspace admin flow.

## Requirements

### Requirement: Team workspaces can be archived and restored within a 60-day window
The system SHALL support archive and restore lifecycle actions for team workspaces. Archiving a team workspace MUST start a 60-day restoration window before permanent deletion. Personal workspaces MUST NOT be archived through the normal workspace admin lifecycle.

#### Scenario: Admin archives a team workspace
- **WHEN** an admin archives a team workspace that is eligible for archival
- **THEN** the system marks the workspace archived and starts a 60-day restoration window

#### Scenario: User attempts to archive a personal workspace
- **WHEN** a user attempts to archive a personal workspace through the normal workspace admin lifecycle
- **THEN** the system refuses the action

#### Scenario: Admin restores an archived team workspace within the window
- **WHEN** an admin restores an archived team workspace before the 60-day restoration window expires
- **THEN** the system returns the workspace to active state instead of deleting it

### Requirement: A workspace cannot be archived while upload or audio processing is active
The system MUST refuse workspace archival while the workspace still has upload activity or non-terminal audio-processing work in progress.

#### Scenario: Admin attempts to archive during active processing
- **WHEN** an admin attempts to archive a workspace that still has upload or non-terminal audio-processing work in progress
- **THEN** the system refuses the archival request

### Requirement: Archived workspaces become unavailable for private transcript surfaces and export immediately
When a workspace is archived, the system SHALL treat it as unavailable immediately for workspace-private transcript surfaces, authenticated transcript export, and related collaboration behavior.

#### Scenario: Member requests a workspace-private transcript surface after archival
- **WHEN** a member requests a workspace-private transcript library or detail surface for a workspace that is archived
- **THEN** the system refuses access to that archived workspace-private transcript surface

#### Scenario: User requests transcript export after archival
- **WHEN** a user requests authenticated transcript export for a workspace that is archived
- **THEN** the system refuses the export request for that archived workspace

### Requirement: Archived workspaces invalidate public share links and invitation acceptance immediately, and restore does not reactivate them
When a workspace is archived, the system SHALL make public share links for that workspace unavailable immediately and SHALL invalidate all pending invitation links immediately. Restoring the workspace MUST NOT reactivate the earlier invitation links or previously enabled public share links. `member` and `admin` users MUST perform a fresh share-management action after restore before public sharing becomes active again.

#### Scenario: Visitor opens a public share link after archival
- **WHEN** a visitor opens a public share link for a transcript in an archived workspace
- **THEN** the system returns unavailable behavior for that link

#### Scenario: User opens an invitation link after archival
- **WHEN** a user opens a pending invitation link for a workspace that has been archived
- **THEN** the system refuses acceptance and does not create a membership

#### Scenario: Admin restores a workspace after archival
- **WHEN** an admin restores a workspace that was previously archived
- **THEN** the old invitation links remain invalid, the old public share links remain unavailable, and fresh invitations or fresh public-share management are required before those access paths become active again

### Requirement: Archived workspaces terminate active markdown edit sessions
When a workspace is archived, the system SHALL release active transcript markdown edit locks for that workspace, MUST reject further autosave attempts for those transcript edit sessions, and MUST refuse any later same-tab resume attempt for those prior edit sessions.

#### Scenario: User is editing transcript markdown during archival
- **WHEN** a workspace is archived while a user holds an active transcript markdown edit session in that workspace
- **THEN** the system releases the edit lock and rejects subsequent autosave or same-tab resume attempts for that archived workspace

### Requirement: Unrestored archived team workspaces are deleted after the restoration window elapses
The system SHALL permanently delete an archived team workspace only after its 60-day restoration window elapses without restoration.

#### Scenario: Archived workspace reaches the end of the restoration window
- **WHEN** an archived team workspace reaches the end of its 60-day restoration window without being restored
- **THEN** the system permanently deletes that workspace
