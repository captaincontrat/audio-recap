## ADDED Requirements

### Requirement: Verified authenticated users can browse their private transcript library
The system SHALL provide a private transcript library for verified authenticated users. The library MUST return only transcript records owned by the current user, including records in processing, completed, and failed states. Each library item SHALL expose summary metadata sufficient for browsing: title, processing status, and lifecycle timestamps.

#### Scenario: User opens a non-empty library
- **WHEN** a verified authenticated user requests the transcript library
- **THEN** the system returns only transcript records owned by that user with summary metadata for each item

#### Scenario: User has no transcript records
- **WHEN** a verified authenticated user requests the transcript library and owns no transcript records
- **THEN** the frontend shows an empty-library state rather than a generic error

### Requirement: The library supports server-side search, baseline organization controls, and cursor pagination
The transcript library SHALL support server-side query controls so users can find owned records efficiently. The library MUST support text search across transcript title, transcript content, and recap content. The library MUST support sort options for newest first, oldest first, recently updated, title A-Z, and title Z-A. The library MUST support filtering by processing status. The library SHALL use cursor-based pagination with a default page size of 20 items and an explicit "Load more" interaction rather than infinite scroll.

#### Scenario: Initial page load uses the default pagination strategy
- **WHEN** a user opens the transcript library without custom query controls
- **THEN** the system returns the first page of up to 20 records using the default sort order and indicates whether more results are available

#### Scenario: User loads the next page of results
- **WHEN** a user activates "Load more" and more transcript results are available
- **THEN** the system returns the next cursor page for the same search, sort, and filter state

#### Scenario: Search or status filters produce no matches
- **WHEN** a user applies a search query or status filter that matches no owned transcript records
- **THEN** the frontend shows a no-results state that preserves the active query controls

### Requirement: Users can open a transcript detail page for an owned record
The system SHALL provide a transcript detail page for one owned transcript record. The detail surface MUST return the record's canonical `transcriptMarkdown` and `recapMarkdown` fields when they exist, along with the record's title, processing status, and privacy-safe lifecycle metadata. The frontend MUST render the canonical markdown fields as readable content instead of requiring HTML content from the backend.

#### Scenario: User opens a completed transcript detail page
- **WHEN** a user opens a completed transcript record they own
- **THEN** the detail page renders the canonical transcript markdown and recap markdown for that record

#### Scenario: User opens an in-progress or failed transcript detail page
- **WHEN** a user opens an owned transcript record that is still processing or has failed
- **THEN** the detail page shows the record status and available metadata even if canonical markdown content is incomplete or absent

### Requirement: Private transcript reads are owner-scoped and do not reveal foreign records
The system MUST enforce ownership on transcript library and detail operations. A user MUST NOT be able to browse another user's private transcript record. Requests for missing records and non-owned records MUST produce the same not-found behavior so the system does not reveal whether another user's record exists.

#### Scenario: User requests a transcript record owned by someone else
- **WHEN** a user requests the detail view for a transcript record they do not own
- **THEN** the system responds with not-found behavior instead of exposing the foreign record

### Requirement: Library and detail surfaces expose distinct loading and error states
The transcript library and transcript detail page SHALL expose explicit loading and error states rather than collapsing them into blank pages. The library MUST distinguish between initial loading, empty library, no-results, and fetch error states. The detail page MUST distinguish between loading, not-found or unavailable, and fetch error states and MUST allow retry from recoverable fetch errors.

#### Scenario: Library data is still loading
- **WHEN** the transcript library request is still in flight
- **THEN** the frontend shows a dedicated loading state for the library

#### Scenario: Library request fails
- **WHEN** the transcript library request fails because of a recoverable fetch error
- **THEN** the frontend shows an error state with a retry action

#### Scenario: Detail request fails or record is unavailable
- **WHEN** the transcript detail request fails or resolves to not-found behavior
- **THEN** the frontend shows the corresponding error or unavailable state instead of an empty content area
