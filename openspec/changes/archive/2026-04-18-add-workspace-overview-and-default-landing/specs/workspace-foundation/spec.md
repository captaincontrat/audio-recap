## MODIFIED Requirements

### Requirement: Authenticated entry without explicit workspace lands deterministically
The system SHALL preserve an explicit post-authentication destination when one is provided and resolves to an authorized workspace-scoped private route. When no explicit destination is provided, the system SHALL choose a server-validated default workspace by preferring the last successfully used accessible active workspace and otherwise falling back to the user's personal workspace. After resolving that default workspace, the system MUST land the user on the overview route for that workspace rather than on a generic non-workspace dashboard placeholder. The system MUST NOT use an archived or inaccessible workspace as the default authenticated destination.

#### Scenario: Explicit authenticated destination is preserved
- **WHEN** a user completes authentication with an explicit authorized destination such as `returnTo` for a workspace-scoped private route
- **THEN** the system redirects to that explicit destination instead of replacing it with a remembered or fallback workspace

#### Scenario: Last valid workspace is reused as the default
- **WHEN** a signed-in user enters an authenticated private surface without an explicit workspace destination and the server still remembers a last successfully used workspace that remains accessible and active
- **THEN** the system redirects or resolves into that workspace's overview route

#### Scenario: Personal workspace is the safe fallback
- **WHEN** a signed-in user enters an authenticated private surface without an explicit workspace destination and no remembered workspace is still both accessible and active
- **THEN** the system redirects or resolves into the user's personal workspace overview route

#### Scenario: Dashboard entry resolves into the default workspace overview
- **WHEN** a signed-in user requests the generic authenticated dashboard entry point without an explicit workspace destination
- **THEN** the system redirects that user to the overview route of the resolved default workspace
