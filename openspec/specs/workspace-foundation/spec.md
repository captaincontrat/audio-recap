# workspace-foundation Specification

## Purpose

Defines the durable workspace boundary that transcript-adjacent product capabilities (meeting processing, transcript library, sharing, export) build on top of. This capability owns the workspace types (`personal`, `team`), membership roles (`read_only`, `member`, `admin`), auto-creation of one personal workspace per account, the minimum workspace-resolution contract for authenticated routes (URL-authoritative workspace context, deterministic default landing), the ownership-plus-creator-attribution pattern for workspace-scoped resources, and the invariants that preserve at least one eligible active admin on every active team workspace and prevent personal workspaces from being left or deleted through normal lifecycle actions.

## Requirements

### Requirement: Every account has a personal workspace
The system SHALL create exactly one personal workspace for every user account. The personal workspace MUST exist before the account can use workspace-scoped product features.

#### Scenario: New account receives a personal workspace
- **WHEN** a new user account is created
- **THEN** the system creates one personal workspace for that account and associates the user to it before workspace-scoped product access begins

### Requirement: Workspace access is role-based and membership-scoped
The system SHALL represent workspace access through memberships rather than direct user ownership. Each workspace membership MUST carry exactly one role from `read_only`, `member`, or `admin`.

#### Scenario: User belongs to multiple workspaces
- **WHEN** a user belongs to more than one workspace
- **THEN** the system evaluates access separately for each workspace membership and its assigned role

### Requirement: Workspace-scoped private routes use explicit workspace context
The system SHALL resolve the current workspace for workspace-scoped authenticated routes and API operations from the explicit workspace identifier in the route, such as `workspaceSlug`. Server session state and remembered workspace preference MUST NOT override that explicit route context. The system SHALL treat session-held or remembered workspace state only as a default-selection helper for authenticated entry points that do not yet specify a workspace.

#### Scenario: Explicit workspace route wins over remembered state
- **WHEN** a user opens a workspace-scoped private route whose explicit workspace identifier differs from the last remembered or session-held workspace
- **THEN** the system resolves the current workspace from the explicit route context rather than overriding it with remembered state

#### Scenario: Two tabs can target different workspaces
- **WHEN** the same signed-in user opens two workspace-scoped private routes with different explicit workspace identifiers in different browser tabs
- **THEN** each tab resolves and preserves its own current workspace from its route context

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

### Requirement: Eligible active admins are defined by role and account access state
The system SHALL treat a workspace membership as an eligible active admin only when the membership role is `admin` and the associated account remains active with normal authenticated access.

#### Scenario: Admin membership on an inactive account does not count
- **WHEN** a workspace has an admin membership whose associated account is closed or otherwise lacks normal authenticated access
- **THEN** the system does not count that membership as an eligible active admin for active-workspace invariants

### Requirement: Transcript-adjacent resources are workspace-owned and creator-attributed
The system SHALL associate each new transcript-adjacent product resource with exactly one workspace as its durable ownership boundary. The system MUST also retain creator attribution separately from workspace ownership in a way that later account-lifecycle work can clear the creator-account reference without deleting the resource itself.

#### Scenario: Member creates a transcript resource
- **WHEN** a workspace member creates a new transcript resource
- **THEN** the system stores the resource under that workspace and separately retains which user created it while the creating account exists

### Requirement: Active team workspaces always retain at least one eligible active admin
The system MUST refuse any operation that would leave an active team workspace with no eligible active admins.

#### Scenario: Last eligible active admin removal or disqualification is refused
- **WHEN** an operation would remove, downgrade, or otherwise disqualify the last eligible active admin of an active team workspace
- **THEN** the system refuses the operation and leaves the workspace with at least one eligible active admin

### Requirement: Personal workspaces cannot be left or deleted through normal workspace lifecycle actions
The system MUST refuse normal leave and delete actions for a personal workspace.

#### Scenario: User attempts to leave a personal workspace
- **WHEN** the owner of a personal workspace attempts to leave it or delete it through normal workspace lifecycle actions
- **THEN** the system refuses the action and preserves the personal workspace
