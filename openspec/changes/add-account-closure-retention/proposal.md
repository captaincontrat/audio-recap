## Why

Once users can belong to multiple workspaces and personal workspaces cannot be deleted, V1 account lifecycle should not promise immediate permanent deletion. A closure model with controlled retention and last-eligible-active-admin handoff rules is safer, more realistic, and better aligned with collaborative ownership.

## What Changes

- Replace the V1 permanent account-deletion model with retained account closure or deactivation plus a 30-day self-service reactivation window, followed by permanent deletion when that window elapses without reactivation.
- Require recent authentication before account closure, plus fresh second-factor verification when the user has 2FA enabled.
- Require the last eligible active admin of a non-personal workspace to promote another member to admin before account closure can proceed.
- Define how account closure interacts with a non-deletable personal workspace during the reactivation window, final deletion of that workspace during permanent account deletion, and generic deleted-user attribution for retained workspace-owned resources.
- Keep transcript transfer into a personal workspace out of the V1 closure contract.

## Capabilities

### New Capabilities
- `account-closure-retention`: V1 account closure or deactivation, 30-day reactivation behavior, permanent deletion after expiry, generic deleted-user attribution for retained workspace-owned resources, and last-eligible-active-admin handoff rules in a collaborative workspace model.

### Modified Capabilities
- None.

## Impact

- The current account-security planning will need to move away from immediate-delete-on-submit semantics toward closure, reactivation, and expiry-driven deletion semantics.
- Account lifecycle UX and backend state will need closure-aware retention, 30-day self-service reactivation behavior, expired-window permanent deletion, and recent-auth plus fresh-2FA step-up checks.
- Workspace-admin invariants will need to be enforced during account closure attempts using eligible active admins rather than raw admin memberships.
- Personal-workspace and creator-attribution rules will need to stay consistent across suspended, reactivated, and permanently deleted accounts.
