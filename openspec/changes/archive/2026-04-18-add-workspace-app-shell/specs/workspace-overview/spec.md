## MODIFIED Requirements

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
