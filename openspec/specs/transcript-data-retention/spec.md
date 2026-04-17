# transcript-data-retention Specification

## Purpose

Defines the durable workspace-owned transcript record as the product resource produced by a meeting submission, the privacy-safe shape of what is persisted long-term, and the strict retention rule that source media and transient notes are deleted before terminal processing states are published. Sits alongside `meeting-import-processing`, which owns the submission and async lifecycle, and underpins later capabilities such as `add-transcript-management`, sharing, and export that will read and manage these durable records. Raw meeting notes, original filenames, transient blob references, and raw provider payloads are intentionally not durable; this capability owns the rule that they do not survive terminal state transitions.

## Requirements

### Requirement: The transcript record is the durable product resource
The system SHALL treat the transcript record as the durable resource created by a meeting submission. Each transcript record MUST belong to one workspace and MUST persist `workspaceId` plus creator attribution. While the creating account exists, that creator attribution MUST include `createdByUserId`. Each transcript record MUST persist the canonical content fields `transcriptMarkdown` and `recapMarkdown` when processing completes successfully. Each transcript record MUST also persist the privacy-safe metadata needed for consultation and future management: processing status, title, source media kind, original media duration, submitted-with-notes flag, and lifecycle timestamps.

#### Scenario: Submission creates a durable transcript record before processing completes
- **WHEN** a verified authenticated user with transcript-creation access submits valid meeting media in the current workspace
- **THEN** the system creates a transcript record for that workspace in a non-terminal processing state even before canonical markdown fields have been filled

#### Scenario: Completed transcript persists canonical markdown fields
- **WHEN** processing completes successfully
- **THEN** the transcript record persists `workspaceId`, `createdByUserId`, canonical `transcriptMarkdown`, canonical `recapMarkdown`, and the generated title as durable content

#### Scenario: Creator account is permanently deleted later
- **WHEN** a workspace-owned transcript survives while the account that originally created it is permanently deleted later by account-lifecycle rules
- **THEN** the transcript remains under the same workspace ownership boundary even if `createdByUserId` is later cleared

### Requirement: Durable transcript records store only privacy-safe metadata
The system MUST minimize long-term retained metadata to what is needed to consult and manage transcript records. The durable transcript record MUST NOT persist original filenames, local filesystem paths, transient blob references, raw meeting notes, raw source media, or raw provider payloads. Terminal failures MAY persist only a generic failure code and a generic failure summary suitable for user display.

#### Scenario: Completed transcript is inspected after success
- **WHEN** the durable transcript record is read after successful processing
- **THEN** it contains only canonical markdown fields and privacy-safe metadata, and does not contain original filenames, raw notes, or transient storage references

#### Scenario: Failed transcript is inspected after terminal failure
- **WHEN** the durable transcript record is read after terminal failure
- **THEN** it exposes only a generic failure code and generic failure summary instead of raw provider or infrastructure error payloads

### Requirement: Source media and transient notes are deleted before terminal states are published
The system SHALL delete uploaded source media and transient notes after processing reaches a terminal outcome. A transcript record MUST NOT be published as `completed` or `failed` until the system has deleted the transient media and transient notes associated with that transcript attempt.

#### Scenario: Successful processing completes cleanup before completion
- **WHEN** the worker finishes generating transcript content for a successful submission
- **THEN** it deletes the transient media and transient notes before marking the transcript record as `completed`

#### Scenario: Failed processing completes cleanup before failure
- **WHEN** the worker determines that a submission has reached terminal failure
- **THEN** it deletes the transient media and transient notes before marking the transcript record as `failed`

### Requirement: Raw notes are transient processing inputs, not durable content
Optional notes supplied at submission time SHALL be used only as transient processing input. The long-term system of record MUST NOT retain the raw notes text after the transcript reaches a terminal state. The durable transcript record MAY retain only whether notes were submitted.

#### Scenario: Submission includes notes and processing completes
- **WHEN** a user submits notes and the transcript later reaches a terminal state
- **THEN** the raw notes text is no longer retained and only the durable transcript record plus the `submittedWithNotes` fact remains
