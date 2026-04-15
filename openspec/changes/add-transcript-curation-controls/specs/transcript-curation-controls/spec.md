## ADDED Requirements

### Requirement: Owners can rename transcript records without overwriting the processing-owned title
The system SHALL allow the owner of a transcript record to provide a nullable `customTitle` override while preserving the processing-owned `title` field as the durable baseline. The user-visible display title MUST be computed as `customTitle ?? title`.

#### Scenario: Owner renames a transcript record
- **WHEN** the owner submits a new custom title for a transcript record
- **THEN** the system persists the `customTitle` override and returns the updated display title for that record

#### Scenario: Owner clears a previous custom title override
- **WHEN** the owner removes the custom title override from a transcript record
- **THEN** the system falls back to the processing-owned `title` as the display title

### Requirement: Owners can edit canonical transcript and recap markdown for completed records
The system SHALL allow the owner of a transcript record to edit the record's canonical markdown content through markdown-first curation surfaces. Transcript and recap editing MUST accept markdown input and MUST persist updated markdown as the canonical backend fields. Transcript and recap editing SHALL only be available for transcript records in `completed` status.

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
- **THEN** the system persists the updated important state and reflects it in the private library and detail surfaces

### Requirement: Owners can organize their private library by important state and tags
The private transcript library SHALL expose curation-focused organization controls in addition to the reduced library's baseline query behavior. The library MUST support sort options for important-first, important-last, tag-list A-Z, and tag-list Z-A. For tag-list sorting, each transcript record MUST use a deterministic normalized tag sort key derived from its sorted normalized tag list, with untagged records ordered after tagged records for ascending tag sort and before tagged records for descending tag sort. The library MUST support filters for important state and one or more selected tags.

#### Scenario: User sorts the library by important state
- **WHEN** a user selects the important-first sort option
- **THEN** the system returns owned transcript records with important records ordered before non-important records

#### Scenario: User sorts the library by tags
- **WHEN** a user selects tag-list A-Z sort
- **THEN** the system orders owned transcript records by the normalized tag sort key and places untagged records after tagged records

#### Scenario: User filters by selected tags
- **WHEN** a user filters the private transcript library by one or more tags
- **THEN** the system returns only owned transcript records whose normalized tag set matches the selected filter values

### Requirement: Owners can delete transcript records with explicit confirmation
The system SHALL allow the owner of a transcript record to permanently delete that record. The frontend MUST require explicit confirmation before issuing the delete request. After successful deletion, the record MUST no longer appear in the owner's private library or detail view.

#### Scenario: Owner confirms transcript deletion
- **WHEN** the owner confirms deletion of a transcript record
- **THEN** the system permanently deletes the record and removes it from subsequent private library and detail reads

#### Scenario: Owner cancels the delete flow
- **WHEN** the owner opens the delete confirmation flow but cancels it
- **THEN** no transcript deletion occurs

### Requirement: Transcript curation is owner-scoped and does not reveal foreign records
The system MUST enforce ownership on all transcript-curation operations, including patch and delete. A user MUST NOT be able to manage another user's private transcript record. Requests for missing records and non-owned records MUST produce the same not-found behavior so the system does not reveal whether another user's record exists.

#### Scenario: User attempts to update or delete a non-owned record
- **WHEN** a user sends a patch or delete request for a transcript record they do not own
- **THEN** the system refuses the action with the same not-found behavior used for missing records
