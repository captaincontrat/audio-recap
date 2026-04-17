## Context

The workspace foundation establishes the ownership boundary and the role model, but it does not yet define how team workspaces gain members or how admins manage access over time. Invitation and membership rules contain enough lifecycle and security detail that they should remain separate from the core workspace model.

This change covers the human access flows for team workspaces:

- adding and removing members
- changing roles
- inviting existing users or invited email addresses without an account yet
- coordinating invitation flows with archive lifecycle defined by `add-workspace-archival-lifecycle`

It does not redefine workspace ownership, archival, or transcript-edit locking.

## Goals / Non-Goals

**Goals:**

- Define admin-managed membership add, remove, and role-change rules for team workspaces.
- Preserve at least one eligible active admin, as defined by `add-workspace-foundation`, during member removal and role changes.
- Define invitation issuance for both existing accounts and email addresses that do not yet have an account.
- Define invitation lifecycle rules for expiration, revocation, resend, and single-use acceptance.
- Define how invitation acceptance validates email identity.
- Forbid invitations and extra memberships for personal workspaces.
- Keep archive-owned invitation invalidation and post-restore re-invite behavior delegated to `add-workspace-archival-lifecycle`.

**Non-Goals:**

- Workspace foundation or resource ownership rules.
- Public share-link behavior beyond invitation/archive coordination.
- Transcript markdown edit sessions.
- Account-closure flows.
- Team directory features beyond membership administration.

## Decisions

### Decision: Membership administration belongs to team-workspace admins only

Membership add, remove, and role-change actions are admin-managed operations and apply only to team workspaces. Personal workspaces remain single-user and do not expose the team membership model as a user-facing management surface.

These mutations must also preserve at least one eligible active admin, using the shared notion defined in `add-workspace-foundation`.

**Why this over alternatives**

- Over allowing any member to manage membership: it would weaken the purpose of the admin role.
- Over letting personal workspaces reuse the same UI affordances: that would invite unsupported states.

### Decision: Refuse removal or downgrade of the last eligible active admin

Membership mutations must not leave a team workspace without an eligible active admin. If a removal or role change would eliminate the last eligible active admin, the system refuses that mutation instead of applying it.

**Why this over alternatives**

- Over permitting the mutation and hoping another admin appears later: the workspace would enter an invalid governance state.
- Over counting every raw admin membership regardless of account access state: an inaccessible admin cannot satisfy the collaboration invariant in practice.

### Decision: Invitations are addressed to one normalized email and one target role

Each invitation is created for:

- one normalized email address
- one target team workspace
- one target role (`read_only`, `member`, or `admin`)

This keeps acceptance rules deterministic even before the invited person has an account.

**Why this over alternatives**

- Over invitations tied only to a user ID: email-first invites would not work for people without an account yet.
- Over invitations with no fixed target role: admins need to know what access the invite grants before acceptance.

### Decision: Keep only one active pending invitation per email per workspace

A workspace should not accumulate unlimited parallel pending invitations for the same email address. Resending refreshes the pending invitation instead of creating many active invite records.

**Why this over alternatives**

- Over unlimited parallel invites: revocation and support behavior become harder to reason about.
- Over refusing resend entirely: admins need a clean way to replace lost or expired links.

### Decision: Invitation tokens are single-use, expiring, revocable, and refresh on resend

The invitation policy is:

- invitations expire 7 days after issuance
- any workspace admin can revoke a pending invitation
- resend rotates to a fresh token and refreshes the expiration window
- acceptance consumes the token permanently

Expired, revoked, superseded, and already-consumed links should all collapse to the same generic unavailable or expired-invitation behavior.

**Why this over alternatives**

- Over reusable or long-lived links: the access grant is too sensitive for that.
- Over distinct public error pages for every invalid state: generic failure reveals less internal invitation state.

### Decision: Acceptance requires the invited email identity

Invitation acceptance is bound to the invited normalized email address. If the invited person does not yet have an account, they can create one with that email and then accept the invitation. If a signed-in user tries to accept a link for a different email, the system blocks acceptance and requires the matching account.

**Why this over alternatives**

- Over allowing any signed-in user to consume the invite link: that would let email-targeted access drift to the wrong account.
- Over requiring the invite to be accepted only by already-existing accounts: it would weaken the onboarding path for invited users.

### Decision: Archive-owned invitation invalidation remains in `add-workspace-archival-lifecycle`

This change depends on `add-workspace-archival-lifecycle` for the rules that archive state invalidates pending invitations and keeps pre-archive invitation links invalid after restore. Membership and invitation flows consume that lifecycle state, but they do not redefine it here.

**Why this over alternatives**

- Over restating archive side effects here: invitation and archive policy would drift across parallel changes.
- Over ignoring archive coordination entirely: invitation acceptance still needs a clear dependency on workspace lifecycle state.

### Decision: Personal workspaces do not support invitations or extra memberships

Personal workspaces use the shared workspace foundation but do not expose team collaboration access-management flows. They do not support invitation links or additional memberships.

**Why this over alternatives**

- Over partially supporting invites into personal workspaces: it would collapse the distinction between personal and team ownership models.
- Over modeling personal workspaces as a special one-user team UI: it adds clutter without product value.

## Risks / Trade-offs

- [Invitation lifecycle rules can feel strict when users switch email addresses or sign into the wrong account] -> Keep the matching-email rule explicit in the acceptance flow and allow admins to resend to the correct address.
- [Role changes and membership removal can race with the last-eligible-active-admin invariant] -> Enforce admin-preservation rules transactionally on the server.
- [Archive-owned invitation invalidation lives in a separate change] -> Keep the dependency on `add-workspace-archival-lifecycle` explicit so invitation handling does not drift.

## Migration Plan

1. Add durable invitation records keyed by normalized email, workspace, role, status, token hash, and expiration.
2. Add team-workspace admin APIs and UI flows for membership add/remove, role change, invite send, invite revoke, and invite resend.
3. Add invitation acceptance flows that support both existing accounts and invite-first account creation.
4. Integrate invitation acceptance with archive state defined by `add-workspace-archival-lifecycle` rather than duplicating archive policy in this change.

Rollback strategy:

- keep durable membership records intact even if invitation issuance is temporarily disabled
- invalidate outstanding invite tokens if invitation handling must be withdrawn

## Open Questions

- None are blocking for this change. Archive-driven invitation invalidation and post-restore behavior remain an explicit dependency on `add-workspace-archival-lifecycle`.
