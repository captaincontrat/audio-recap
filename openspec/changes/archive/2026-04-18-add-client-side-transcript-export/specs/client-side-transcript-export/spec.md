## ADDED Requirements

### Requirement: Workspace users with read access can export completed transcripts in four formats in active workspaces
The system SHALL allow an authenticated workspace user with read access to a completed transcript record in an active workspace to export that record in `md`, `txt`, `pdf`, and `docx` formats from authenticated transcript-management surfaces. Export actions MUST be workspace-scoped read actions and MUST be available to `read_only`, `member`, and `admin` roles when they can read the transcript. Export actions MUST NOT be available for transcript records that are not in `completed` status. If `workspace-archival-lifecycle` marks the workspace archived, the system MUST refuse export until the workspace becomes active again.

#### Scenario: `read_only` user exports a completed transcript
- **WHEN** a `read_only` user requests an export for a completed transcript record they can read
- **THEN** the system produces a download in the requested format

#### Scenario: User attempts to export a non-completed transcript
- **WHEN** a user requests an export for a transcript record that is not in `completed` status
- **THEN** the system refuses the export action

#### Scenario: User attempts to export from an archived workspace
- **WHEN** a user requests an export for a completed transcript record whose workspace is archived
- **THEN** the system refuses the export action because `workspace-archival-lifecycle` makes archived workspaces unavailable for private transcript surfaces and export

#### Scenario: User attempts to export a transcript without workspace read access
- **WHEN** a user requests an export for a transcript record they cannot read through the current workspace membership
- **THEN** the system refuses the export action using the same not-found or unavailable behavior used for other workspace-scoped transcript-management reads

### Requirement: The backend remains markdown-first and the frontend performs format conversion locally
The backend SHALL send canonical markdown to the frontend for transcript export. The backend MUST NOT generate `md`, `txt`, `pdf`, or `docx` export files on behalf of the frontend. The frontend SHALL convert the canonical markdown into the requested export format locally.

#### Scenario: Workspace user starts an export
- **WHEN** a workspace user triggers an export from an authenticated transcript-management surface
- **THEN** the backend sends the canonical transcript markdown, recap markdown, and display title to the frontend and the frontend performs the format conversion locally

### Requirement: Exported documents are assembled from the latest canonical transcript content
The export flow SHALL assemble one export document from the current canonical transcript record using this order: display title, recap section, transcript section. Exports MUST use the latest canonical content, including any workspace-authorized edits to the title, recap markdown, or transcript markdown.

#### Scenario: User exports after transcript content was updated
- **WHEN** a user exports a transcript after an authorized workspace user updated the title, recap markdown, or transcript markdown
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
