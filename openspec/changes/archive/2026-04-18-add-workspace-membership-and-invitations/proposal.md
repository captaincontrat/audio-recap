## Why

The workspace foundation alone does not let teams form or administer access. Membership management and invitation lifecycle rules are core collaboration flows, but they add enough policy detail that they should stay separate from the ownership foundation.

## What Changes

- Add admin-managed member add, remove, and role-change behavior for team workspaces, including refusal to remove or downgrade the last eligible active admin.
- Add invitation flows for both existing accounts and invited email addresses without accounts yet.
- Define invitation lifecycle rules: 7-day expiration, revoke, resend, single-use acceptance, and matching-email acceptance rules.
- Treat archive-driven invitation invalidation and post-restore re-invite behavior as a dependency on `add-workspace-archival-lifecycle` rather than redefining that policy here.
- Explicitly forbid invitations, extra memberships, and invitation links for personal workspaces.

## Capabilities

### New Capabilities
- `workspace-membership-and-invitations`: Team-workspace membership administration, role changes, invitation issuance, invitation acceptance, and invitation lifecycle rules.

### Modified Capabilities
- None.

## Impact

- Postgres will need durable invitation state in addition to workspace memberships.
- The app will need admin surfaces and APIs for membership changes and invitation management.
- Email delivery and acceptance routes will become part of the collaboration model.
- This change depends on `add-workspace-archival-lifecycle` for archive-driven invitation invalidation and post-restore re-invite behavior.
