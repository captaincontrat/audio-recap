## ADDED Requirements

### Requirement: Account closure requires recent authentication and fresh second-factor verification when 2FA is enabled
The system MUST allow V1 account closure only after the user completes recent authentication for that closure attempt. If the user has 2FA enabled, the system MUST also require a fresh second-factor verification before closure can proceed.

#### Scenario: User attempts closure without recent authentication
- **WHEN** a user attempts to close their account without completing recent authentication for that closure attempt
- **THEN** the system refuses to complete account closure until recent authentication is completed

#### Scenario: User with 2FA enabled attempts closure without fresh second-factor verification
- **WHEN** a user who has 2FA enabled attempts to close their account without completing a fresh second-factor verification for that closure attempt
- **THEN** the system refuses to complete account closure until fresh second-factor verification is completed

### Requirement: Account closure places the account into a retained inactive state with a 30-day self-service reactivation window
The system SHALL support V1 account closure or deactivation by placing the account into a retained inactive state rather than immediately performing permanent destructive deletion. Closing the account MUST revoke active sessions, MUST suspend normal authenticated access, and MUST start a 30-day self-service reactivation window.

#### Scenario: User closes their account
- **WHEN** a user completes the V1 account-closure flow
- **THEN** the system revokes the user's active sessions, suspends normal authenticated access, places the account into a retained inactive state instead of deleting it immediately, and starts a 30-day self-service reactivation window

### Requirement: Closed accounts can be reactivated within 30 days only through fresh sign-in
The system SHALL allow a user to reactivate a closed account only during the 30-day reactivation window. Reactivation MUST require a fresh sign-in. If the account has 2FA enabled, reactivation MUST also require a fresh second-factor verification for that reactivation attempt. Reactivation MUST restore normal authenticated access but MUST NOT restore revoked sessions or roll back workspace membership or admin changes that occurred while the account was closed.

#### Scenario: User reactivates a closed account within 30 days
- **WHEN** a user completes account reactivation during the 30-day reactivation window
- **THEN** the system restores normal authenticated access and does not restore any previously revoked sessions

#### Scenario: User with 2FA enabled reactivates a closed account
- **WHEN** a user who has 2FA enabled attempts to reactivate a closed account during the 30-day reactivation window
- **THEN** the system requires a fresh second-factor verification before the reactivation completes

#### Scenario: Workspace state changed while the account was closed
- **WHEN** a user reactivates an account after their workspace membership, role, or admin state changed during the closed period
- **THEN** the system restores account access without undoing those workspace changes

### Requirement: Closed accounts are permanently deleted when the 30-day window elapses without reactivation
The system MUST permanently delete a closed account when its 30-day reactivation window elapses without successful reactivation. That permanent deletion MUST remove the account's remaining team-workspace memberships and MUST NOT leave the account in a further self-restorable state.

#### Scenario: Closed account reaches the end of the 30-day window
- **WHEN** a closed account reaches the end of its 30-day reactivation window without successful reactivation
- **THEN** the system permanently deletes that account and removes its remaining team-workspace memberships

### Requirement: The last eligible active admin of a non-personal workspace must hand off admin responsibility before account closure
The system MUST refuse account closure when the user is the last eligible active admin of a non-personal workspace and no other eligible active admin exists. Only eligible active admins satisfy this invariant.

#### Scenario: Last eligible active admin attempts account closure without handoff
- **WHEN** a user who is the last eligible active admin of a non-personal workspace attempts to close their account before promoting another member to admin
- **THEN** the system refuses the account-closure request

#### Scenario: Another eligible active admin already exists
- **WHEN** a user who is not the sole remaining eligible active admin of any non-personal workspace closes their account
- **THEN** the system allows the account-closure flow to proceed

#### Scenario: Ineligible admin membership does not satisfy handoff
- **WHEN** a user attempts to close their account and the only other admin membership for a non-personal workspace belongs to an account without normal authenticated access
- **THEN** the system refuses the account-closure request

### Requirement: V1 account closure retains the personal workspace during the reactivation window and deletes it during final permanent deletion
The system MUST retain the user's personal workspace during the 30-day reactivation window after account closure and MUST NOT delete it as part of the initial closure action. If the account is permanently deleted after that window elapses without reactivation, the system MUST delete the personal workspace as part of that deletion.

#### Scenario: User closes account with a personal workspace
- **WHEN** a user with a personal workspace closes their account in V1
- **THEN** the system retains the personal workspace instead of deleting it as part of that initial closure flow

#### Scenario: Closed account reaches final deletion with a personal workspace
- **WHEN** a closed account with a personal workspace reaches the end of its 30-day reactivation window without successful reactivation
- **THEN** the system deletes that personal workspace as part of final permanent account deletion

### Requirement: Permanent account deletion preserves other workspace-owned resources and uses generic deleted-user attribution
The system MUST NOT delete workspace-owned resources in non-personal workspaces solely because their creator account was permanently deleted after the reactivation window elapsed. For retained resources that still track creator attribution by account reference, the system MAY clear that deleted-account reference. Any product surface that continues to display creator attribution for such a retained resource MUST render a generic deleted-user label such as `Former user (deleted)` rather than retaining deleted-account PII.

#### Scenario: Team-workspace transcript survives creator-account deletion
- **WHEN** a transcript belongs to a non-personal workspace and its creator account is permanently deleted after the reactivation window elapses
- **THEN** the transcript remains available under that workspace instead of being deleted solely because the creator account was deleted

#### Scenario: Creator attribution is rendered after permanent account deletion
- **WHEN** a product surface renders creator attribution for a retained workspace-owned resource whose creator account was permanently deleted
- **THEN** the surface shows the generic label `Former user (deleted)` instead of deleted-account identity data

### Requirement: V1 account closure does not transfer transcripts into a personal workspace
The system MUST NOT transfer transcripts from other workspaces into the personal workspace as part of the V1 account-closure flow.

#### Scenario: User closes account while belonging to multiple workspaces
- **WHEN** a user who belongs to multiple workspaces completes the V1 account-closure flow
- **THEN** the system does not transfer transcripts into the personal workspace as part of that flow
