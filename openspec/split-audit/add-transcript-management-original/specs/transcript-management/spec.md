## ADDED Requirements

### Requirement: Verified authenticated users can browse their transcript library
The system SHALL provide a private transcript library for verified authenticated users. The library MUST return only transcript records owned by the current user, including records in processing, completed, and failed states. Each library item SHALL expose summary metadata sufficient for browsing and management: display title, processing status, important flag, tags, and lifecycle timestamps.

#### Scenario: User opens a non-empty library
- **WHEN** a verified authenticated user requests the transcript library
- **THEN** the system returns only transcript records owned by that user with summary metadata for each item

#### Scenario: User has no transcript records
- **WHEN** a verified authenticated user requests the transcript library and owns no transcript records
- **THEN** the frontend shows an empty-library state rather than a generic error

### Requirement: The library supports server-side search, sort, filter, and cursor pagination
The transcript library SHALL support server-side query controls so users can find and organize records efficiently. The library MUST support text search across transcript title, transcript content, recap content, and tags. The library MUST support sort options for newest first, oldest first, recently updated, title A-Z, title Z-A, important-first, important-last, tag-list A-Z, and tag-list Z-A. For tag-list sorting, each transcript record MUST use a deterministic normalized tag sort key derived from its sorted normalized tag list, with untagged records ordered after tagged records for ascending tag sort and before tagged records for descending tag sort. The library MUST support filters for processing status, important state, and one or more selected tags. The library SHALL use cursor-based pagination with a default page size of 20 items and an explicit "Load more" interaction rather than infinite scroll.

#### Scenario: Initial page load uses the default pagination strategy
- **WHEN** a user opens the transcript library without custom query controls
- **THEN** the system returns the first page of up to 20 records using the default sort order and indicates whether more results are available

#### Scenario: User loads the next page of results
- **WHEN** a user activates "Load more" and more transcript results are available
- **THEN** the system returns the next cursor page for the same search, sort, and filter state

#### Scenario: User sorts the library by important state
- **WHEN** a user selects the important-first sort option
- **THEN** the system returns owned transcript records with important records ordered before non-important records

#### Scenario: User sorts the library by tags
- **WHEN** a user selects tag-list A-Z sort
- **THEN** the system orders owned transcript records by the normalized tag sort key and places untagged records after tagged records

#### Scenario: Search or filters produce no matches
- **WHEN** a user applies a search query or filters that match no owned transcript records
- **THEN** the frontend shows a no-results state that preserves the active query controls

### Requirement: Users can open a transcript detail page for an owned record
The system SHALL provide a transcript detail page for one owned transcript record. The detail surface MUST return the transcript record's canonical `transcriptMarkdown` and `recapMarkdown` fields when they exist, along with the record's display title, processing status, tags, important flag, and lifecycle metadata. The frontend MUST render the canonical markdown fields as readable content instead of requiring HTML content from the backend.

#### Scenario: User opens a completed transcript detail page
- **WHEN** a user opens a completed transcript record they own
- **THEN** the detail page renders the canonical transcript markdown and recap markdown for that record

#### Scenario: User opens an in-progress or failed transcript detail page
- **WHEN** a user opens an owned transcript record that is still processing or has failed
- **THEN** the detail page shows the record status and available management metadata even if canonical markdown content is incomplete or absent

### Requirement: Owners can rename transcript records and edit canonical markdown
The system SHALL allow the owner of a transcript record to rename the record and to edit the record's canonical markdown content through markdown-first management surfaces. Title updates MUST change the record's user-visible title without requiring HTML storage. Transcript and recap editing MUST accept markdown input and MUST persist updated markdown as the canonical backend fields. Transcript and recap editing SHALL only be available for transcript records in `completed` status.

#### Scenario: Owner renames a transcript record
- **WHEN** the owner submits a new title for a transcript record
- **THEN** the system persists the updated user-visible title and returns the updated record metadata

#### Scenario: Owner edits transcript and recap markdown
- **WHEN** the owner submits updated markdown for a completed transcript record
- **THEN** the system persists the new canonical `transcriptMarkdown` and `recapMarkdown` values and returns the updated record

#### Scenario: User attempts markdown editing before completion
- **WHEN** a user tries to edit transcript or recap markdown for a transcript record that is not in `completed` status
- **THEN** the system refuses the markdown update

### Requirement: Owners can manage tags and important markers
The system SHALL allow the owner of a transcript record to manage tags and toggle whether a record is marked important. Tags MUST be normalized, case-insensitively deduplicated, and stored as part of the transcript record. The system MUST enforce bounded tag limits for count and length.

#### Scenario: Owner adds and removes tags
- **WHEN** the owner updates the tags on a transcript record
- **THEN** the system persists the normalized deduplicated tag set for that record

#### Scenario: Owner submits duplicate tag values with different casing
- **WHEN** the owner submits tags that normalize to the same value
- **THEN** the system stores only one normalized tag value

#### Scenario: Owner marks or unmarks a transcript as important
- **WHEN** the owner toggles the important marker for a transcript record
- **THEN** the system persists the updated important state and reflects it in the library and detail surfaces

### Requirement: Owners can delete transcript records with explicit confirmation
The system SHALL allow the owner of a transcript record to permanently delete that record. The frontend MUST require explicit confirmation before issuing the delete request. After successful deletion, the record MUST no longer appear in the owner's library or detail view.

#### Scenario: Owner confirms transcript deletion
- **WHEN** the owner confirms deletion of a transcript record
- **THEN** the system permanently deletes the record and removes it from subsequent library and detail reads

#### Scenario: Owner cancels the delete flow
- **WHEN** the owner opens the delete confirmation flow but cancels it
- **THEN** no transcript deletion occurs

### Requirement: Transcript management is owner-scoped and does not reveal foreign records
The system MUST enforce ownership on all transcript-management operations, including list, detail, patch, and delete. A user MUST NOT be able to manage another user's private transcript record. Requests for missing records and non-owned records MUST produce the same not-found behavior so the system does not reveal whether another user's record exists.

#### Scenario: User requests a transcript record owned by someone else
- **WHEN** a user requests the detail view for a transcript record they do not own
- **THEN** the system responds with not-found behavior instead of exposing the foreign record

#### Scenario: User attempts to update or delete a non-owned record
- **WHEN** a user sends a patch or delete request for a transcript record they do not own
- **THEN** the system refuses the action with the same not-found behavior used for missing records

### Requirement: Library and detail surfaces expose distinct loading and error states
The transcript library and transcript detail page SHALL expose explicit loading and error states rather than collapsing them into blank pages. The library MUST distinguish between initial loading, empty library, no-results, and fetch error states. The detail page MUST distinguish between loading, not-found/unavailable, and fetch error states and MUST allow retry from recoverable fetch errors.

#### Scenario: Library data is still loading
- **WHEN** the transcript library request is still in flight
- **THEN** the frontend shows a dedicated loading state for the library

#### Scenario: Library request fails
- **WHEN** the transcript library request fails because of a recoverable fetch error
- **THEN** the frontend shows an error state with a retry action

#### Scenario: Detail request fails or record is unavailable
- **WHEN** the transcript detail request fails or resolves to not-found behavior
- **THEN** the frontend shows the corresponding error or unavailable state instead of an empty content area
