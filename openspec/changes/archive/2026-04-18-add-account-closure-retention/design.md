## Context

The existing auth-hardening direction still talks about permanent account deletion, but the collaboration decisions in the workspace exploration changed the product constraints:

- users can belong to multiple workspaces
- personal workspaces cannot be deleted
- a last eligible active admin of a non-personal workspace must hand off admin responsibility first

Because of that, V1 account lifecycle needs a retained closure model with a bounded reactivation window and eventual permanent deletion rather than immediate destructive deletion. This change isolates that lifecycle adjustment so it does not disappear into a broader security change.

## Goals / Non-Goals

**Goals:**

- Replace V1 permanent account deletion with account closure or deactivation that first enters controlled retention, then permanently deletes the account when a 30-day reactivation window elapses without reactivation.
- Require recent authentication before account closure and fresh second-factor verification when the account has 2FA enabled.
- Define a 30-day self-service reactivation window and expired-window permanent deletion semantics for V1 account closure.
- Define the last-eligible-active-admin handoff rule for non-personal workspaces.
- Define the minimum relationship between account closure and a non-deletable personal workspace.
- Make clear that V1 closure does not move transcripts into the personal workspace.
- Provide a focused contract that later auth-hardening work can retarget to.

**Non-Goals:**

- Immediate permanent deletion at the moment the user confirms closure.
- Transcript transfer between workspaces during account closure.
- Workspace archival lifecycle itself.
- Invitation or transcript edit-session behavior.

## Decisions

### Decision: Use retained account closure with a 30-day reactivation window before final permanent deletion in V1

V1 account lifecycle does not delete the account immediately when the user confirms closure. Instead, closure revokes active access, places the account into a controlled-retention state, and starts a 30-day reactivation window before final permanent deletion.

**Why this over alternatives**

- Over continuing to promise immediate permanent deletion on closure submit: the collaborative workspace model makes immediate destructive cleanup too broad and ambiguous.
- Over leaving the old requirement in place and hoping implementation details will handle it: the product contract itself has changed.

### Decision: Closure revokes active access immediately

When an account is closed:

- active sessions are revoked
- normal authenticated access is suspended
- retained data is not immediately hard-deleted

This keeps closure meaningfully destructive from the user's perspective without forcing immediate permanent deletion at closure time.

**Why this over alternatives**

- Over leaving sessions active during the retention window: the account would be both closed and still operational.
- Over immediately deleting all state: that conflicts with the new controlled-retention direction.

### Decision: Closed accounts remain self-reactivable for 30 days, then are permanently deleted if not reactivated

V1 account closure starts a 30-day self-service reactivation window. During that window, the user may reactivate their closed account. If the 30-day window elapses without successful reactivation, the system permanently deletes the account rather than leaving it indefinitely closed.

This gives users a meaningful recovery path for accidental or reconsidered closure without making the initial closure step perform immediate destructive deletion.

**Why this over alternatives**

- Over leaving the reactivation window unspecified: implementation, UX copy, and support handling need a concrete contract.
- Over matching the 60-day workspace archival window: account closure is a user-lifecycle decision and can reasonably resolve faster than team-workspace archival.
- Over keeping the account forever closed after the window: it leaves dead identity state and unresolved cleanup after the recovery period is over.
- Over a much shorter window: accidental closures or travel and recovery delays would become harder to recover from.

### Decision: Closure requires recent authentication and fresh second-factor verification when 2FA is enabled

Account closure is a high-risk account action. Before the system allows closure:

- the user must complete recent authentication
- if the account has 2FA enabled, the user must also complete a fresh second-factor verification for that closure attempt

**Why this over alternatives**

- Over allowing stale session state to authorize closure: closing an account is too sensitive to rely on old authentication.
- Over requiring only the first factor when 2FA is enabled: it would bypass the stronger verification already configured for that account.

### Decision: Reactivation requires fresh sign-in and fresh second-factor verification when 2FA is enabled, and does not rewind prior state

A closed account may be reactivated only through a fresh sign-in flow during the 30-day reactivation window. If the account has 2FA enabled, the user must also complete a fresh second-factor verification for that reactivation attempt.

Reactivation restores normal authenticated access, but it does not rewind prior state:

- revoked sessions remain invalid
- workspace membership, role, and admin changes made while the account was closed remain authoritative

**Why this over alternatives**

- Over reactivating from stale in-session state: account closure should require an explicit re-entry flow rather than reviving a dead session.
- Over restoring previously revoked sessions: that would undermine the immediate access suspension guaranteed by closure.
- Over rolling back workspace changes made while the account was closed: other valid workspace-admin actions should remain authoritative.

### Decision: Permanent deletion removes the account and personal workspace but preserves other workspace-owned resources

When the 30-day reactivation window elapses without reactivation, permanent deletion:

- deletes the user account
- removes any remaining team-workspace memberships for that account
- deletes the user's personal workspace
- preserves workspace-owned resources in other workspaces rather than deleting them solely because the creator account was deleted

For retained workspace-owned resources that still track creator attribution by account reference, later resource contracts may null that deleted-account reference. Any product surface that still renders creator attribution after that point should use a generic deleted-user label such as `Former user (deleted)` rather than retaining deleted-account PII.

**Why this over alternatives**

- Over keeping a forever-closed user row after the reactivation window: it leaves dead identity state around after the recovery period has ended.
- Over deleting collaborative workspace data with the account: workspace-owned resources should follow workspace ownership, not creator-account lifetime.
- Over retaining deleted-account PII only to render creator attribution: a generic deleted-user label preserves product clarity without keeping that identity data alive.

### Decision: The last eligible active admin of a non-personal workspace must hand off admin responsibility first

A user who is the last eligible active admin of a non-personal workspace cannot close their account until another member has been promoted to admin for that workspace.

Only eligible active admins, as defined by the workspace foundation, count toward satisfying this invariant. Raw admin memberships on closed or otherwise access-suspended accounts do not.

**Why this over alternatives**

- Over allowing closure and repairing admin ownership later: the workspace would enter an invalid governance state.
- Over automatically transferring workspace ownership to some arbitrary member: admin handoff should be explicit.
- Over counting any raw admin membership even when the account no longer has normal authenticated access: the workspace could appear covered while no admin can actually govern it.

### Decision: Personal workspaces are retained during the reactivation window and not deleted as part of initial closure

The personal workspace remains non-deletable through normal workspace lifecycle actions. Initial account closure does not destroy it; the workspace is retained during the 30-day reactivation window. If the account reaches final permanent deletion, the personal workspace is deleted as part of that final cleanup.

**Why this over alternatives**

- Over deleting the personal workspace immediately when closure starts: it would make accidental closures harder to unwind during the reactivation window.
- Over retaining the personal workspace after final account deletion: it would leave orphaned single-user workspace state after the owning identity is gone.
- Over trying to move other workspace data into the personal workspace during closure: the conversation explicitly deferred that behavior.

### Decision: V1 closure does not transfer transcripts into a personal workspace

The earlier idea of moving transcripts into a personal workspace during a last-eligible-active-admin closure flow is treated as future policy work, not part of V1.

**Why this over alternatives**

- Over defining transcript transfer now: the team-data implications were not resolved and would expand the closure scope significantly.
- Over silently implying transfer behavior through implementation: this change should keep the V1 contract narrow and explicit.

## Risks / Trade-offs

- [Users may expect the phrase "close account" to mean immediate hard deletion] -> Make the 30-day reactivation window and final permanent deletion explicit in the product copy and flow.
- [Recent-auth and fresh-2FA prerequisites add friction to closure] -> Keep the step-up requirement explicit and scoped only to the closure attempt.
- [A 30-day reactivation window is shorter than the 60-day workspace-archival window] -> Keep account and workspace lifecycle copy explicit so the two windows are not conflated.
- [Reactivation does not restore old sessions or rewind workspace changes made while closed] -> Make the post-reactivation state explicit instead of implying a full historical rollback.
- [Permanent deletion must preserve collaborative workspace data while removing deleted-account identity] -> Keep workspace ownership authoritative and use generic deleted-user attribution where needed.

## Migration Plan

1. Retarget the existing account-security planning away from immediate-delete-on-submit semantics and toward closure, reactivation, and expiry-driven deletion.
2. Add account lifecycle state that can represent active versus closed retained accounts, including closure timestamps and a 30-day reactivation deadline.
3. Require recent authentication and, when 2FA is enabled, fresh second-factor verification before closure completes.
4. Enforce last-eligible-active-admin handoff checks before closure can proceed.
5. Revoke sessions and suspend normal access when closure completes.
6. Allow self-service reactivation within 30 days only through fresh sign-in and fresh second-factor verification when 2FA is enabled.
7. Keep prior sessions invalid and preserve any workspace membership, role, or admin changes made while the account was closed.
8. When the 30-day window elapses without reactivation, permanently delete the account and remove any remaining team-workspace memberships for that account.
9. Delete the personal workspace as part of final permanent account deletion, while preserving workspace-owned resources in other workspaces and nulling deleted-account creator references where later resource contracts require it.
10. Keep transcript-transfer behavior out of the V1 flow and use a generic deleted-user label such as `Former user (deleted)` on any surfaces that still render creator attribution after permanent deletion.

Rollback strategy:

- if account closure UX must be withdrawn, the system can preserve the retained-state schema additions while hiding the closure flow
- the old permanent-delete wording should not be reintroduced without a new design pass that resolves the collaborative workspace implications

## Open Questions

None are blocking for this change.
