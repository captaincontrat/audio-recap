# transcript-curation-controls Specification

## Purpose

Defines workspace-scoped transcript curation controls for the reduced transcript records owned by `private-transcript-library` and surfaced by `transcript-management`: a nullable `customTitle` override that feeds the `customTitle ?? title` effective-title rule without overwriting the processing-owned `title`, workspace-scoped tag management with normalization and bounded limits, an important-state toggle, important-first/important-last and tag-list A-Z/Z-A library organization with tag filters, and permanent transcript deletion with confirmation, creator-aware member rules, admin override for retained transcripts whose creator was deleted, and the same not-found behavior for missing and out-of-workspace records. Honors the active-workspace requirement owned by `workspace-archival-lifecycle` for every curation surface. Markdown edit sessions for `transcriptMarkdown` and `recapMarkdown` are out of scope for this capability and are defined separately by `transcript-edit-sessions`.

## Requirements

### Requirement: Workspace members and admins can rename transcript records without overwriting the processing-owned title
The system SHALL allow a workspace user with role `member` or `admin` to provide a nullable `customTitle` override for any transcript record in the current workspace while preserving the processing-owned `title` field as the durable baseline. This change owns the effective-title calculation rule `customTitle ?? title`. `add-transcript-management` owns the stable `displayTitle` read contract that exposes the result on library and detail surfaces.

#### Scenario: Workspace member renames a transcript record
- **WHEN** a workspace `member` or `admin` submits a new custom title for a transcript record in the current workspace
- **THEN** the system persists the `customTitle` override and subsequent transcript-management read surfaces return the updated effective title for that record

#### Scenario: Workspace member clears a previous custom title override
- **WHEN** a workspace `member` or `admin` removes the custom title override from a transcript record in the current workspace
- **THEN** the system falls back to the processing-owned `title` through the same effective-title rule

### Requirement: Workspace members and admins can manage tags and important markers
The system SHALL allow workspace users with role `member` or `admin` to manage tags and toggle whether a transcript record is marked important on any transcript in the current workspace. Tags MUST be normalized, case-insensitively deduplicated, and stored as part of the transcript record. The system MUST enforce bounded tag limits for count and length.

#### Scenario: Workspace member adds and removes tags
- **WHEN** a workspace `member` or `admin` updates the tags on a transcript record in the current workspace
- **THEN** the system persists the normalized deduplicated tag set for that record

#### Scenario: Workspace member submits duplicate tag values with different casing
- **WHEN** a workspace `member` or `admin` submits tags that normalize to the same value
- **THEN** the system stores only one normalized tag value

#### Scenario: Workspace member marks or unmarks a transcript as important
- **WHEN** a workspace `member` or `admin` toggles the important marker for a transcript record in the current workspace
- **THEN** the system persists the updated important state and reflects it in the workspace transcript library and detail surfaces

### Requirement: Workspace transcript library supports important-state and tag-aware organization
The workspace transcript library SHALL expose curation-focused organization controls in addition to the reduced library's baseline query behavior. The library MUST support sort options for important-first, important-last, tag-list A-Z, and tag-list Z-A. For tag-list sorting, each transcript record MUST use a deterministic normalized tag sort key derived from its sorted normalized tag list, with untagged records ordered after tagged records for ascending tag sort and before tagged records for descending tag sort. The library MUST support filters for important state and one or more selected tags.

#### Scenario: User sorts the library by important state
- **WHEN** a user selects the important-first sort option in a workspace transcript library
- **THEN** the system returns workspace transcript records with important records ordered before non-important records

#### Scenario: User sorts the library by tags
- **WHEN** a user selects tag-list A-Z sort in a workspace transcript library
- **THEN** the system orders workspace transcript records by the normalized tag sort key and places untagged records after tagged records

#### Scenario: User filters by selected tags
- **WHEN** a user filters the workspace transcript library by one or more tags
- **THEN** the system returns only workspace transcript records whose normalized tag set matches the selected filter values

### Requirement: Transcript deletion follows workspace roles and explicit confirmation
The system SHALL allow permanent deletion of a transcript record within the current workspace. A workspace `member` MAY delete only transcript records whose creator attribution still resolves to that member's current account. A workspace `admin` MAY delete any transcript record in the workspace, including retained records whose creator account was later permanently deleted. The frontend MUST require explicit confirmation before issuing the delete request. After successful deletion, the record MUST no longer appear in the workspace transcript library or detail view.

#### Scenario: Member confirms deletion of a transcript they created
- **WHEN** a workspace `member` confirms deletion of a transcript record they created in the current workspace
- **THEN** the system permanently deletes the record and removes it from subsequent workspace library and detail reads

#### Scenario: Member attempts to delete another user's transcript
- **WHEN** a workspace `member` sends a delete request for a transcript record in the current workspace that they did not create
- **THEN** the system refuses the deletion

#### Scenario: Member attempts to delete a transcript whose creator account was permanently deleted
- **WHEN** a workspace `member` sends a delete request for a retained transcript record in the current workspace whose `createdByUserId` no longer resolves because the creator account was permanently deleted
- **THEN** the system refuses the deletion

#### Scenario: Admin deletes another user's transcript
- **WHEN** a workspace `admin` confirms deletion of a transcript record created by another workspace user
- **THEN** the system permanently deletes the record and removes it from subsequent workspace library and detail reads

#### Scenario: Admin deletes a retained transcript whose creator account was permanently deleted
- **WHEN** a workspace `admin` confirms deletion of a retained transcript record in the current workspace whose creator account was permanently deleted
- **THEN** the system permanently deletes the record and removes it from subsequent workspace library and detail reads

#### Scenario: User cancels the delete flow
- **WHEN** a user opens the delete confirmation flow but cancels it
- **THEN** no transcript deletion occurs

### Requirement: Transcript curation uses workspace scoping and role-based authorization
The system MUST scope transcript-curation operations by the current workspace. For workspace-scoped private curation routes, the current workspace SHALL be resolved from the explicit workspace route context defined by `add-workspace-foundation`, and session or remembered workspace state MUST NOT override that explicit route context. Metadata curation operations for `customTitle`, `tags`, and `isImportant` MUST be allowed only for workspace `member` and `admin` roles. Requests for missing transcript records and transcript records outside the current workspace MUST produce the same not-found behavior so the system does not reveal whether another workspace's record exists. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, and these curation surfaces MUST honor that active-workspace requirement. Markdown edit sessions for `transcriptMarkdown` and `recapMarkdown` are out of scope for this change and are defined separately by `add-transcript-edit-sessions`.

#### Scenario: Read-only user attempts metadata curation
- **WHEN** a workspace `read_only` user sends a patch request for `customTitle`, `tags`, or `isImportant`
- **THEN** the system refuses the mutation

#### Scenario: User targets a transcript outside the current workspace
- **WHEN** a user sends a patch or delete request for a transcript record outside the current workspace
- **THEN** the system refuses the action with the same not-found behavior used for missing records

#### Scenario: User attempts curation in an archived workspace
- **WHEN** a user sends a curation request for a current workspace that is archived
- **THEN** the system refuses active collaboration access for that archived workspace
