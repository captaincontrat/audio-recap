## ADDED Requirements

### Requirement: Team workspace admins can add, remove, and change member roles
The system SHALL allow admins of a team workspace to add existing users, remove members, and change membership roles for that workspace. The system MUST refuse these actions for non-admin users.

#### Scenario: Admin adds an existing account to a team workspace
- **WHEN** an admin of a team workspace adds an existing user account to that workspace with a selected role
- **THEN** the system creates the workspace membership with that role

#### Scenario: Non-admin attempts to manage memberships
- **WHEN** a non-admin user attempts to add, remove, or change another member in a team workspace
- **THEN** the system refuses the action

### Requirement: Team workspace membership mutations preserve an eligible active admin
The system MUST refuse any membership removal or role change that would leave a team workspace without an eligible active admin, as defined by the workspace foundation.

#### Scenario: Last eligible active admin removal is refused
- **WHEN** an admin attempts to remove the last eligible active admin from a team workspace
- **THEN** the system refuses the removal and preserves at least one eligible active admin for that workspace

#### Scenario: Last eligible active admin downgrade is refused
- **WHEN** an admin attempts to change the last eligible active admin of a team workspace to a non-admin role
- **THEN** the system refuses the role change and preserves at least one eligible active admin for that workspace

### Requirement: Team workspace admins can invite people by email
The system SHALL allow admins of a team workspace to create invitations for normalized email addresses whether or not those email addresses already belong to an account. Each invitation MUST target exactly one workspace and one role.

#### Scenario: Admin invites an email without an account yet
- **WHEN** an admin sends an invitation to an email address that does not yet belong to an existing account
- **THEN** the system creates a pending invitation for that normalized email and target role

#### Scenario: Admin invites an email that already belongs to an account
- **WHEN** an admin sends an invitation to an email address that already belongs to an existing account
- **THEN** the system still creates a pending invitation for that normalized email and target role

### Requirement: Invitation links are expiring, revocable, resendable, and single-use
The system SHALL issue invitation links that expire 7 days after issuance. The system SHALL allow workspace admins to revoke pending invitations and resend them. Resend MUST issue a fresh token, invalidate the previous token immediately, and refresh the expiration window. Accepted invitation tokens MUST be consumed immediately and MUST NOT be reusable.

#### Scenario: Admin resends a pending invitation
- **WHEN** an admin resends a still-pending invitation
- **THEN** the system issues a fresh token, invalidates the previous token immediately, and resets the invitation expiration window from the resend time

#### Scenario: User opens a revoked, expired, superseded, or consumed invitation link
- **WHEN** a user opens an invitation link that is no longer valid
- **THEN** the system returns the same generic unavailable or expired-invitation behavior without creating a membership

### Requirement: Invitation acceptance requires the invited email identity
The system SHALL create a workspace membership from an invitation only when the invited person completes account-auth flows for the invited normalized email address. If a signed-in user attempts to accept an invitation for a different email address than their account, the system MUST refuse acceptance.

#### Scenario: Invited person creates an account and accepts later
- **WHEN** a person without an account receives an invitation, creates an account with the invited email address, and then accepts the invitation
- **THEN** the system creates the workspace membership for that account and consumes the invitation token

#### Scenario: Signed-in user tries to accept an invitation for a different email
- **WHEN** a signed-in user opens an invitation addressed to a different normalized email than their account
- **THEN** the system refuses acceptance and does not create a workspace membership

### Requirement: Personal workspaces do not support invitations or extra memberships
The system MUST refuse invitation issuance and extra membership creation for personal workspaces.

#### Scenario: User attempts to invite someone into a personal workspace
- **WHEN** a user attempts to create an invitation or additional membership for a personal workspace
- **THEN** the system refuses the action

