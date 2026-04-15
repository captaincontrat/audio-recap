## ADDED Requirements

### Requirement: Owners can export completed transcripts in four formats
The system SHALL allow the owner of a completed transcript record to export that record in `md`, `txt`, `pdf`, and `docx` formats from authenticated transcript-management surfaces. Export actions MUST be owner-scoped and MUST NOT be available for transcript records that are not in `completed` status.

#### Scenario: Owner exports a completed transcript
- **WHEN** the owner requests an export for a completed transcript record in one of the supported formats
- **THEN** the system produces a download in the requested format

#### Scenario: User attempts to export a non-completed transcript
- **WHEN** a user requests an export for a transcript record that is not in `completed` status
- **THEN** the system refuses the export action

#### Scenario: User attempts to export a foreign transcript
- **WHEN** a user requests an export for a transcript record they do not own
- **THEN** the system refuses the export action using the same owner-scoped behavior used for other private transcript-management actions

### Requirement: The backend remains markdown-first and the frontend performs format conversion locally
The backend SHALL send canonical markdown to the frontend for transcript export. The backend MUST NOT generate `md`, `txt`, `pdf`, or `docx` export files on behalf of the frontend. The frontend SHALL convert the canonical markdown into the requested export format locally.

#### Scenario: Owner starts an export
- **WHEN** an owner triggers an export from an authenticated transcript-management surface
- **THEN** the backend sends the canonical transcript markdown, recap markdown, and display title to the frontend and the frontend performs the format conversion locally

### Requirement: Exported documents are assembled from the latest canonical transcript content
The export flow SHALL assemble one export document from the current canonical transcript record using this order: display title, recap section, transcript section. Exports MUST use the latest canonical content, including any owner edits to the title, recap markdown, or transcript markdown.

#### Scenario: Owner exports after editing transcript content
- **WHEN** the owner exports a transcript after updating the title, recap markdown, or transcript markdown
- **THEN** the exported file includes the latest canonical title, recap content, and transcript content in that order

### Requirement: Public share pages do not expose export actions
Public transcript share pages SHALL remain read-only and MUST NOT expose the authenticated export actions defined by this capability.

#### Scenario: Visitor opens a valid public share URL
- **WHEN** a visitor views a publicly shared transcript
- **THEN** the page does not expose export controls for `md`, `txt`, `pdf`, or `docx`

### Requirement: Export failures are surfaced without mutating transcript content
If client-side conversion fails for a requested export format, the frontend SHALL surface an error to the user and SHALL NOT mutate the transcript record or its canonical markdown fields.

#### Scenario: Client-side conversion fails
- **WHEN** the frontend cannot complete conversion of canonical markdown into the requested export format
- **THEN** the frontend reports the export failure and the transcript record remains unchanged
