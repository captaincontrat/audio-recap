# workspace-overview Specification

## Purpose

Defines the workspace overview route at `w/[slug]` that serves as the canonical landing surface for a resolved current workspace. The overview composes existing workspace-scoped transcript reads from `private-transcript-library` into two activity projections — an active-work group (transcripts whose processing has not reached a terminal successful state, plus terminal failed transcripts surfaced as attention-worthy) and a library-highlights group (recently updated transcripts) — and provides direct navigation into the full transcript library plus a transcript-creation-gated start-upload CTA that opens the shared workspace shell's drop-then-confirm upload handoff for the current workspace. Inherits the explicit workspace route context, role-based access model, and archived-workspace behavior from `workspace-foundation` and `workspace-archival-lifecycle` rather than inventing a separate access model. Does not introduce any new workspace-scoped server endpoints; the shell-level upload entry points themselves are owned by `workspace-app-shell`.

## Requirements

### Requirement: Each accessible workspace has an overview route
The system SHALL provide a workspace overview route at the current workspace root, `w/[slug]`, for verified authenticated users with read access in that workspace. The overview SHALL use the explicit workspace route context defined by `workspace-foundation`, and it SHALL behave like other private workspace surfaces for inaccessible or archived workspaces rather than inventing a separate access model. On workspace-scoped routes, the overview page SHALL render inside the shared workspace shell.

#### Scenario: User opens an active workspace overview
- **WHEN** a verified authenticated user with read access opens `w/[slug]` for an active workspace
- **THEN** the system renders the overview for that workspace inside the shared workspace shell

#### Scenario: Inaccessible workspace overview stays hidden
- **WHEN** a user requests `w/[slug]` for a workspace they cannot access
- **THEN** the system responds with the same not-found behavior used for other private workspace-scoped routes

#### Scenario: Archived workspace overview shows inactive-workspace behavior
- **WHEN** a user requests `w/[slug]` for a workspace that is archived
- **THEN** the system refuses the normal active overview and shows the archived-workspace behavior used by private workspace surfaces

### Requirement: The workspace overview summarizes current workspace activity
The workspace overview SHALL summarize the current workspace rather than acting as an account settings page. The overview MUST surface two workspace-scoped activity groups: an active-work group that combines transcripts whose processing has not yet reached a terminal successful state (including queued, preprocessing, transcribing, generating_recap, generating_title, finalizing, and retrying) together with transcripts in terminal failed states, and a library-highlights group that surfaces recently updated transcripts the user can open. Transcripts in terminal failed states MUST appear inside the active-work group as attention-worthy items so the user notices them without switching pages. The overview SHALL also provide direct navigation to the full transcript library and, for users with transcript-creation access, to the shell-level upload entry points.

#### Scenario: Overview shows active work with failed items surfaced
- **WHEN** the current workspace contains a mix of non-terminal transcripts and transcripts in terminal failed states visible to the user
- **THEN** the overview shows them together inside the active-work group and marks the failed items as attention-worthy

#### Scenario: Overview shows library highlights from recent transcripts
- **WHEN** the current workspace contains recently updated transcripts the user can read
- **THEN** the overview shows a library-highlights group summarizing those recent transcripts

#### Scenario: Empty workspace overview uses an empty state
- **WHEN** the current workspace has no visible transcript records for the current user
- **THEN** the overview shows an empty state instead of empty summary sections

#### Scenario: Read-only member sees overview without create action
- **WHEN** a user with read-only access opens the workspace overview
- **THEN** the overview still shows workspace activity groups but does not present a create-work CTA that implies transcript-submission access

### Requirement: The overview is the product landing surface for a resolved current workspace
The workspace overview SHALL be the default product landing page for a resolved current workspace. When the system chooses a default workspace for an authenticated user and there is no explicit private destination to preserve, the user SHALL land on that workspace's overview route rather than on a separate generic dashboard page. The overview MAY still provide deep links into dedicated transcript library or submission surfaces, but it SHALL remain the canonical workspace home. The overview's start-upload call-to-action, for users with transcript-creation access, SHALL open the shared workspace shell's drop-then-confirm upload handoff associated with the current workspace.

#### Scenario: Default landing opens the resolved workspace overview
- **WHEN** the system resolves a current workspace for an authenticated user who has no explicit private destination to preserve
- **THEN** the user lands on that workspace's overview route

#### Scenario: Overview navigates into the transcript library
- **WHEN** a user chooses to browse all transcripts from the overview
- **THEN** the system routes them to the transcript library surface for the same workspace

#### Scenario: Overview hands off upload actions to the shell upload entry points
- **WHEN** a user with transcript-creation access triggers a start-upload action from the overview
- **THEN** the system opens the same drop-then-confirm handoff used by the shell's header upload control for the current workspace
