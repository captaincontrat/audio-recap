# private-transcript-library Specification

## Purpose

Defines the durable library and detail read surfaces for workspace-owned transcript records produced by `meeting-import-processing`. Establishes `displayTitle` as the stable read-side title contract that later curation work can layer onto, scopes every read to the current workspace resolved from the explicit URL slug (`workspace-foundation`), honors the active-workspace rule from `workspace-archival-lifecycle`, and provides server-side search, baseline `displayTitle`/time sort controls, status filtering, and cursor pagination with a default page size of 20 plus an explicit "Load more" interaction. Also defines the explicit loading, empty, no-results, not-found, and retryable error states for both the library and the single-transcript detail page. Transcript editing, sharing, curation, and export are out of scope and belong to downstream capabilities.

## Requirements

### Requirement: Library and detail read surfaces expose stable `displayTitle`
The system SHALL expose `displayTitle` as the stable read-side title field for transcript library and detail surfaces. `displayTitle` MUST represent the effective transcript title regardless of whether the current value comes directly from the processing-owned `title` or from later curation inputs. `add-transcript-curation-controls` owns the effective-title calculation rule when `customTitle` is available, but this change owns the durable read contract that surfaces the result.

#### Scenario: Transcript without a custom title exposes the processing title through `displayTitle`
- **WHEN** a transcript record has no curation title override
- **THEN** the library and detail read surfaces return the processing-owned `title` value through `displayTitle`

#### Scenario: Transcript with a custom title exposes the effective title through `displayTitle`
- **WHEN** a transcript record has a curation title override
- **THEN** the library and detail read surfaces return the effective title through `displayTitle`

### Requirement: Verified authenticated users with read access can browse the private transcript library for the current workspace
The system SHALL provide a private transcript library for verified authenticated users in the current workspace context. For workspace-scoped private library and detail routes, the current workspace SHALL be resolved from the explicit workspace route context defined by `add-workspace-foundation`, and session or remembered workspace state MUST NOT override that explicit route context. The library MUST return only transcript records that belong to the current workspace and are readable by the current user there, including records in processing, completed, and failed states. Each library item SHALL expose summary metadata sufficient for browsing: `displayTitle`, processing status, and lifecycle timestamps.

#### Scenario: User opens a non-empty library
- **WHEN** a verified authenticated user with read access requests the transcript library in the current workspace
- **THEN** the system returns only transcript records from that workspace with summary metadata for each item

#### Scenario: Read-only workspace member can browse the library
- **WHEN** a verified authenticated user with `read_only` access requests the transcript library in the current workspace
- **THEN** the system returns transcript records from that workspace with the same summary browsing projection used for other read-capable roles

#### Scenario: User has no transcript records
- **WHEN** a verified authenticated user requests the transcript library and the current workspace has no visible transcript records
- **THEN** the frontend shows an empty-library state rather than a generic error

### Requirement: The library supports server-side search, baseline organization controls, and cursor pagination
The transcript library SHALL support server-side query controls so users can find transcript records in the current workspace efficiently. The library MUST support text search across the stable `displayTitle`, transcript content, and recap content. The library MUST support sort options for newest first, oldest first, recently updated, `displayTitle` A-Z, and `displayTitle` Z-A. The library MUST support filtering by processing status. The library SHALL use cursor-based pagination with a default page size of 20 items and an explicit "Load more" interaction rather than infinite scroll.

#### Scenario: Initial page load uses the default pagination strategy
- **WHEN** a user opens the transcript library without custom query controls
- **THEN** the system returns the first page of up to 20 records using the default sort order and indicates whether more results are available

#### Scenario: User loads the next page of results
- **WHEN** a user activates "Load more" and more transcript results are available
- **THEN** the system returns the next cursor page for the same search, sort, and filter state

#### Scenario: Search or status filters produce no matches
- **WHEN** a user applies a search query or status filter that matches no transcript records in the current workspace
- **THEN** the frontend shows a no-results state that preserves the active query controls

### Requirement: Users can open a transcript detail page for a record in the current workspace
The system SHALL provide a transcript detail page for one transcript record in the current workspace. The detail surface MUST return the record's canonical `transcriptMarkdown` and `recapMarkdown` fields when they exist, along with the record's `displayTitle`, processing status, and privacy-safe lifecycle metadata. The frontend MUST render the canonical markdown fields as readable content instead of requiring HTML content from the backend.

#### Scenario: User opens a completed transcript detail page
- **WHEN** a user with read access opens a completed transcript record in the current workspace
- **THEN** the detail page renders the canonical transcript markdown and recap markdown for that record

#### Scenario: User opens an in-progress or failed transcript detail page
- **WHEN** a user with read access opens a transcript record in the current workspace that is still processing or has failed
- **THEN** the detail page shows the record status and available metadata even if canonical markdown content is incomplete or absent

### Requirement: Private transcript reads are workspace-scoped and do not reveal out-of-workspace records
The system MUST enforce current-workspace scoping on transcript library and detail operations. A user MUST NOT be able to browse transcript records outside the current workspace through this surface, even if the user belongs to another workspace that contains the transcript. `add-workspace-archival-lifecycle` owns the rule that archived workspaces are inactive for collaboration, and this read surface MUST honor that active-workspace requirement. Requests for missing records and records outside the current workspace MUST produce the same not-found behavior so the system does not reveal whether another workspace record exists.

#### Scenario: User requests a private transcript surface for an archived workspace
- **WHEN** a user requests the transcript library or detail surface for a current workspace that is archived
- **THEN** the system refuses active workspace-private access for that archived workspace

#### Scenario: User requests a transcript record outside the current workspace
- **WHEN** a user requests the detail view for a transcript record that does not belong to the current workspace
- **THEN** the system responds with not-found behavior instead of exposing the out-of-workspace record

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
