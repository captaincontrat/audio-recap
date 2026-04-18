## ADDED Requirements

### Requirement: `member` and `admin` users can enable, disable, and rotate public sharing for completed transcripts
The system SHALL allow a `member` or `admin` of an active workspace to enable public sharing, disable public sharing, and rotate the active share secret for a completed transcript record in that workspace. Public sharing MUST NOT be enabled for transcript records that are not in `completed` status. Share-management actions MUST be workspace-scoped. Users with the `read_only` role MUST NOT manage public sharing.

#### Scenario: Member enables public sharing for a completed workspace transcript
- **WHEN** a `member` enables public sharing for a completed transcript record in their workspace
- **THEN** the system creates or reuses a stable public share identifier, creates a fresh active share secret, marks the share as enabled, and returns a public share URL

#### Scenario: Admin disables public sharing
- **WHEN** an `admin` disables public sharing for a shared transcript record in their workspace
- **THEN** the system invalidates the active public link and no longer serves the transcript from that link

#### Scenario: `read_only` user attempts to rotate the share secret
- **WHEN** a `read_only` user attempts to rotate the share secret for a completed transcript record in their workspace
- **THEN** the system refuses the share-management action

#### Scenario: User attempts to enable sharing for an incomplete transcript
- **WHEN** a user tries to enable public sharing for a transcript record that is not in `completed` status
- **THEN** the system refuses to enable sharing

### Requirement: Public share URLs use a double-UUID design
The system SHALL expose public transcript links using a double-UUID URL design. Each public URL MUST include a stable public share identifier UUID and a rotatable share secret UUID. The public URL MUST NOT expose the internal transcript identifier.

#### Scenario: Public share URL is generated
- **WHEN** the system returns a public share link for an enabled transcript
- **THEN** the link uses the shape `/share/<publicShareId>/<shareSecretId>` where both path segments are UUIDs

### Requirement: Workspace users can organize their private library by public sharing state
The authenticated transcript-management surfaces SHALL expose whether each transcript record visible in the current workspace is currently publicly shared. The private transcript library MUST support sorting visible workspace transcript records by public sharing state with `shared-first` and `unshared-first` options. The private transcript library MUST also support filtering visible workspace transcript records by public sharing state.

#### Scenario: Workspace member sorts the library by public sharing state
- **WHEN** a `member` selects the shared-first sort option in the private transcript library
- **THEN** the system returns visible workspace transcript records with shared transcripts ordered before unshared transcripts

#### Scenario: `read_only` user filters the library to shared transcripts only
- **WHEN** a `read_only` user applies a shared-only filter in the private transcript library
- **THEN** the system returns only visible workspace transcript records whose public sharing state is currently enabled

### Requirement: Public share pages are read-only and privacy-minimal
The system SHALL render public shared transcripts as read-only pages. The public page MUST expose only privacy-minimal content needed for a useful shared transcript view: display title, canonical recap markdown, and canonical transcript markdown. The public page MUST NOT expose creator identity, workspace membership information, transcript identifiers, workspace identifiers, tags, important state, processing status, failure information, notes metadata, source media metadata, share-management controls, or export actions.

#### Scenario: Visitor opens a valid public share link
- **WHEN** a visitor opens a valid enabled public share URL
- **THEN** the system renders a read-only page containing only the display title, canonical recap markdown, and canonical transcript markdown for that transcript

#### Scenario: Signed-in workspace member opens the public share page
- **WHEN** a signed-in workspace member opens a valid public share URL while authenticated
- **THEN** the system still renders the same read-only public page instead of exposing private management controls on that route

### Requirement: Public share pages always reflect the current canonical transcript content
The public share page SHALL render the current canonical display title, recap markdown, and transcript markdown from the transcript record. If an authorized workspace user later updates those canonical fields through authenticated transcript management, subsequent public reads SHALL reflect the updated canonical content.

#### Scenario: Workspace member updates a shared transcript after enabling sharing
- **WHEN** an authorized workspace user edits the transcript title, recap markdown, or transcript markdown for a currently shared transcript
- **THEN** subsequent visits to the valid public share URL render the updated canonical content

### Requirement: Invalid, disabled, rotated, and missing links share the same unavailable behavior
The public share surface MUST NOT reveal whether a transcript exists, was previously shared, or had its share secret rotated. Requests using a missing share identifier, wrong secret, disabled share, rotated old link, or deleted transcript MUST all resolve to the same unavailable/not-found behavior.

#### Scenario: Visitor opens an old rotated link
- **WHEN** a visitor opens a public share URL whose secret UUID was rotated out
- **THEN** the system returns the same unavailable behavior used for any other invalid public share link

#### Scenario: Visitor opens a disabled or missing link
- **WHEN** a visitor opens a public share URL for a disabled share or a nonexistent share
- **THEN** the system returns the same unavailable behavior without revealing which condition caused it

### Requirement: Public transcript sharing applies only while the workspace is active
The system SHALL treat public transcript sharing as available only while the transcript's workspace is active. Whether an archived or restored workspace may currently expose public share URLs MUST follow `workspace-archival-lifecycle`, including its requirement for fresh share management before previously enabled links become active again after restore.

#### Scenario: Visitor opens a public share URL when workspace lifecycle does not allow public sharing
- **WHEN** a visitor opens a public share URL for a transcript whose workspace is not currently active for public sharing under `workspace-archival-lifecycle`
- **THEN** the system returns the same unavailable behavior used for other public share access failures and does not expose any additional share-management state
