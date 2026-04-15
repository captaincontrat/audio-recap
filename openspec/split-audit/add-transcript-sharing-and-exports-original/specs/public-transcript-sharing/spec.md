## ADDED Requirements

### Requirement: Owners can enable, disable, and rotate public sharing for completed transcripts
The system SHALL allow the owner of a completed transcript record to enable public sharing, disable public sharing, and rotate the active share secret. Public sharing MUST NOT be enabled for transcript records that are not in `completed` status. Share-management actions MUST be owner-scoped.

#### Scenario: Owner enables public sharing for a completed transcript
- **WHEN** the owner enables public sharing for a completed transcript record
- **THEN** the system creates or reuses a stable public share identifier, creates a fresh active share secret, marks the share as enabled, and returns a public share URL

#### Scenario: Owner disables public sharing
- **WHEN** the owner disables public sharing for a shared transcript record
- **THEN** the system invalidates the active public link and no longer serves the transcript from that link

#### Scenario: Owner rotates the share secret
- **WHEN** the owner rotates the share secret for an enabled shared transcript record
- **THEN** the system keeps the stable public share identifier, replaces the active share secret with a fresh UUID, and invalidates the previous public link immediately

#### Scenario: User attempts to enable sharing for an incomplete transcript
- **WHEN** a user tries to enable public sharing for a transcript record that is not in `completed` status
- **THEN** the system refuses to enable sharing

### Requirement: Public share URLs use a double-UUID design
The system SHALL expose public transcript links using a double-UUID URL design. Each public URL MUST include a stable public share identifier UUID and a rotatable share secret UUID. The public URL MUST NOT expose the internal transcript identifier.

#### Scenario: Public share URL is generated
- **WHEN** the system returns a public share link for an enabled transcript
- **THEN** the link uses the shape `/share/<publicShareId>/<shareSecretId>` where both path segments are UUIDs

### Requirement: Owners can organize their private library by public sharing state
The authenticated transcript-management surfaces SHALL expose whether each owned transcript is currently publicly shared. The private transcript library MUST support sorting owned transcript records by public sharing state with `shared-first` and `unshared-first` options. The private transcript library MUST also support filtering owned transcript records by public sharing state.

#### Scenario: Owner sorts the library by public sharing state
- **WHEN** the owner selects the shared-first sort option in the private transcript library
- **THEN** the system returns owned transcript records with shared transcripts ordered before unshared transcripts

#### Scenario: Owner filters the library to shared transcripts only
- **WHEN** the owner applies a shared-only filter in the private transcript library
- **THEN** the system returns only owned transcript records whose public sharing state is currently enabled

### Requirement: Public share pages are read-only and privacy-minimal
The system SHALL render public shared transcripts as read-only pages. The public page MUST expose only privacy-minimal content needed for a useful shared transcript view: display title, canonical recap markdown, and canonical transcript markdown. The public page MUST NOT expose owner identity, transcript identifiers, tags, important state, processing status, failure information, notes metadata, source media metadata, or share-management controls.

#### Scenario: Visitor opens a valid public share link
- **WHEN** a visitor opens a valid enabled public share URL
- **THEN** the system renders a read-only page containing only the display title, canonical recap markdown, and canonical transcript markdown for that transcript

#### Scenario: Signed-in owner opens the public share page
- **WHEN** the owner opens a valid public share URL while authenticated
- **THEN** the system still renders the same read-only public page instead of exposing private management controls on that route

### Requirement: Public share pages always reflect the current canonical transcript content
The public share page SHALL render the current canonical display title, recap markdown, and transcript markdown from the transcript record. If the owner later updates those canonical fields through authenticated transcript management, subsequent public reads SHALL reflect the updated canonical content.

#### Scenario: Owner updates a shared transcript after enabling sharing
- **WHEN** the owner edits the transcript title, recap markdown, or transcript markdown for a currently shared transcript
- **THEN** subsequent visits to the valid public share URL render the updated canonical content

### Requirement: Invalid, disabled, rotated, and missing links share the same unavailable behavior
The public share surface MUST NOT reveal whether a transcript exists, was previously shared, or had its share secret rotated. Requests using a missing share identifier, wrong secret, disabled share, rotated old link, or deleted transcript MUST all resolve to the same unavailable/not-found behavior.

#### Scenario: Visitor opens an old rotated link
- **WHEN** a visitor opens a public share URL whose secret UUID was rotated out
- **THEN** the system returns the same unavailable behavior used for any other invalid public share link

#### Scenario: Visitor opens a disabled or missing link
- **WHEN** a visitor opens a public share URL for a disabled share or a nonexistent share
- **THEN** the system returns the same unavailable behavior without revealing which condition caused it
