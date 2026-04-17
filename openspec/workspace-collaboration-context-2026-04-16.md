# Workspace Collaboration Conversation Context

This note preserves the exploration conversation about introducing workspaces and team collaboration so a later discussion can resume without re-reading the full chat.

## Conversation Status

- Date: `2026-04-16`
- Mode: exploration only
- Implementation status: no application code changed in this conversation
- Goal: introduce a proper workspace model early enough to avoid later `ownerUserId`-driven schema and authorization refactors

## Why This Conversation Happened

The current OpenSpec set already assumes an owner-scoped product model in several places:

- `openspec/changes/add-web-meeting-processing/specs/transcript-data-retention/spec.md` says each transcript record belongs to one user.
- `openspec/changes/add-transcript-management/design.md` scopes transcript-management reads by `ownerUserId`.
- `openspec/changes/add-transcript-curation-controls/`, `add-public-transcript-sharing/`, and `add-client-side-transcript-export/` also inherit owner-scoped assumptions.

The main conclusion from the exploration was:

- `workspace` is not just an extra permission layer.
- `workspace` changes the parent resource model for transcripts and later transcript-adjacent features.
- Because of that, it should be introduced before transcript-focused implementation work proceeds too far.

## High-Level Architectural Direction

Recommended model:

```text
User account
    |
    +-- WorkspaceMembership(role = read_only | member | admin)
              |
              v
          Workspace
              |
              +-- Transcripts
              +-- Processing jobs
              +-- Share state
              +-- Export actions
              +-- Membership / invitation state
```

Recommended separation of responsibilities:

- `user` remains the identity and authentication entity.
- `workspace` becomes the main durable collaboration and data boundary.
- `workspace_membership` becomes the authorization layer.
- `transcript` becomes a resource owned by a workspace, not directly by a single user.

Recommended transcript shape additions:

- `workspaceId` on transcripts
- `createdByUserId` on transcripts while the creator account still exists
- later account-lifecycle work may clear that reference without changing workspace ownership
- optionally later `lastEditedByUserId`

Recommended routing direction:

- Prefer explicit workspace-scoped routes such as `/w/[workspaceSlug]/transcripts/[id]` instead of hiding all workspace selection in implicit session state.

## Confirmed User Decisions From This Conversation

The following decisions were explicitly made during the conversation:

- A user can belong to multiple workspaces.
- The first workspace is personal and is created automatically.
- Memberships must support a `read_only` role in addition to broader edit/admin roles.
- Users can be added to workspaces in two ways:
  - by linking an existing account
  - by invitation email
- Public transcript sharing is possible on all eligible transcripts by workspace members.
- A workspace can be archived for 60 days and restored during that window by any workspace admin.
- An archived workspace immediately makes all of its public links unavailable.
- If a workspace is archived, its pending invitations become invalid immediately.
- If an invitation link is opened after workspace archival, acceptance fails and no membership is created.
- Restoring a workspace does not reactivate its old invitation links; admins must send new invitations after restoration if needed.
- `read_only` members can export transcripts because export is treated as a read action.
- A member can delete only transcripts whose creator attribution still resolves to that member.
- An admin can delete any transcript in the workspace, including retained records that are no longer creator-deletable under the member rule.
- For editing collaboration:
  - a lock can be used during editing
  - the lock applies only to markdown editing, not to every transcript mutation
  - transcript saving should happen automatically about 1 second after content modification
  - there is only one lock per transcript, even for the same user across multiple tabs
  - the lock is released and the user is redirected away 20 minutes after the last successful save
  - if the lock expires or is otherwise lost, the editor forces an exit from edit mode and shows an explicit lock-expired message
  - unsaved local changes are not kept in a temporary client-side recovery store
- V1 should use account closure or deactivation with a controlled-retention state and a 30-day self-service reactivation window instead of immediate permanent deletion at submit time.
- If a user wants to close their account while they are the last admin of a non-personal workspace, they must first promote another member to admin.
- The personal workspace is retained during V1 account closure, and the account remains closed rather than becoming self-reactivable once the 30-day window expires.
- Transcript transfer into the personal workspace stays out of scope for the V1 account-closure model.

## Recommended Role Model

Recommended role enum:

- `read_only`
- `member`
- `admin`

Recommended interpretation of those roles:

### `read_only`

- Can browse the transcript library and detail pages for the workspace.
- Can export transcripts because export is treated as a read action.
- Cannot edit transcripts.
- Cannot delete transcripts.
- Cannot manage members or invitations.
- Cannot archive or restore the workspace.

### `member`

- Can create transcripts in the workspace.
- Can rename, tag, mark important, and edit markdown for any transcript in the workspace, not only transcripts they created.
- Can manage public sharing for any transcript in the workspace that the workspace is allowed to share.
- Can delete only transcripts they created.

### `admin`

- Has all `member` abilities.
- Can delete any transcript in the workspace.
- Can invite users, remove users, and change roles.
- Can archive and restore the workspace.

## Important Authorization Invariant

Critical invariant:

- An active workspace must always have at least one admin.

That invariant should be enforced transactionally on the server, not only in the frontend, for at least these operations:

- leaving a workspace
- removing a member
- downgrading an admin
- deactivating or closing an account
- archiving a workspace

## Recommended Personal Workspace Rules

Recommended constraints for the automatically created personal workspace:

- it is created at account creation time
- it is single-user in practice
- it is not meant to accept extra members
- it cannot be left
- it cannot be deleted through normal workspace lifecycle actions

This keeps the personal workspace distinct from a normal team workspace while still leaving final cleanup during permanent account deletion to account-lifecycle policy rather than normal workspace lifecycle actions.

## Editing and Locking Direction

The conversation evolved beyond simple transcript patching into an edit-session model.

Confirmed edit-session contract from the conversation:

- A single lock is acquired when the user enters transcript edit mode.
- The lock applies only to transcript content editing, not to every minor metadata action.
- Autosave happens with a debounce of about 1 second after content changes.
- Every successful autosave renews the lock lifetime.
- Lock expiry happens 20 minutes after the last successful save.
- When the lock expires or is otherwise lost:
  - the user is removed from edit mode
  - the UI redirects them away from the editor
  - the UI shows an explicit message saying that the lock expired
- No temporary local recovery store is kept for unsaved edits after lock loss.
- If a save arrives after the lock has expired, the server should reject it with a conflict-style response and the client should force an exit from edit mode.
- The system should allow only one lock per transcript, even for the same user across multiple tabs.
- A refresh of the same browser tab should be treated as a short reconnection attempt to the existing edit session, not as a second concurrent session.
- That reconnect should be allowed only for a brief window (about 10 seconds) using the same tab-scoped edit-session identity, and it should reload only the last successfully saved markdown from the server.

Recommended implementation split:

- Postgres remains the durable source of truth for saved content.
- Redis is a strong fit for the ephemeral edit lock because it already exists in the platform direction and supports TTL-based expiry well.

Confirmed lock scope:

- lock `transcriptMarkdown`
- lock `recapMarkdown`

Confirmed non-lock scope:

- `customTitle`
- tags
- important marker
- share-management controls

Reasoning:

- content editing is the real collision-prone area
- broad locking would make the UI feel overly blocked for small metadata actions

Important product note:

- this is not full real-time collaborative editing
- it is coordinated exclusive editing with autosave

## Editing Decisions Now Closed

The earlier lock questions were explicitly closed during the conversation:

- there is one lock per transcript, not one lock per field group
- another tab from the same user still conflicts with the existing lock because only one edit session may exist at a time
- a refresh of the same tab may briefly resume the existing edit session, but only with the same tab-scoped identity and without recovering unsaved local edits
- no temporary local draft recovery exists after lock loss; the user is forced out of edit mode and sees an explicit expiration message

## Deletion and Archival Semantics

Workspace deletion was discussed as an archive-first flow, not instant hard deletion.

Recommended workspace lifecycle:

- admin archives workspace
- workspace cannot be archived while an upload or audio-processing job is in progress for that workspace
- workspace becomes inactive immediately
- a 60-day deletion window begins
- any admin can restore during that window
- permanent deletion happens only after the window elapses without restore

Recommended transcript deletion model:

- `member` can delete only self-created transcripts
- `admin` can delete any transcript

Important consistency implication:

- archived workspaces should likely disable active collaboration surfaces immediately
- public sharing for archived workspaces stops resolving immediately while the workspace is archived
- existing transcript edit locks are released when the workspace is archived
- autosave requests are no longer accepted once the workspace is archived
- any pending same-tab refresh reconnection window should be cancelled when the workspace is archived

## Invitation Lifecycle Proposal

The user asked for a concrete proposal for invitation behavior before splitting this note into formal OpenSpec artifacts.

Proposed invitation model:

- invitations exist only for team workspaces
- personal workspaces cannot send invitations
- invitations are addressed to one normalized email address
- invitations carry the intended workspace role at send time: `read_only`, `member`, or `admin`
- one active pending invitation per normalized email per workspace is enough; resending refreshes that invitation rather than creating unlimited parallel pending invites

Proposed expiration:

- invitations expire 7 days after issuance

Proposed revocation:

- any workspace admin can revoke a pending invitation
- revoked invitations become unusable immediately
- revoked invitations do not create memberships even if an old link is opened later

Proposed resend behavior:

- any workspace admin can resend a still-pending invitation
- resending issues a fresh single-use token and invalidates the previous token immediately
- resending refreshes the expiration window from the resend time

Proposed single-use behavior:

- invitation acceptance tokens are single-use
- once an invitation is accepted, its token is consumed immediately and cannot be reused
- expired, revoked, superseded, and already-consumed invitation links should all resolve to the same generic unavailable or expired-invitation behavior

Confirmed archive interaction:

- archiving a workspace invalidates all pending invitation links for that workspace immediately
- invitation acceptance after archival must fail without creating a membership
- restored workspaces do not reactivate prior invitation links
- admins must send fresh invitations after restoration if access still needs to be granted

Proposed behavior when the invited email does not yet have an account:

- the invitation remains pending for that normalized email
- the invited person can create an account with that email and accept the invitation afterward
- membership is created only after the invited user completes the required account-auth flow for that email
- if a signed-in user tries to accept an invitation for a different email address than their current account, the system should block acceptance and ask them to use or create the matching account

Proposed explicit personal-workspace rule:

- personal workspaces do not support invitations, extra memberships, or invitation links

## V1 Account Closure Direction

Later OpenSpec work clarified that V1 should not perform immediate permanent deletion at the moment the user confirms closure.

V1 direction:

- use account deactivation or closure with controlled retention
- revoke active sessions and suspend normal authenticated access immediately on closure
- require recent authentication and fresh second-factor verification when 2FA is enabled
- allow self-service reactivation for 30 days after closure
- keep the account closed and no longer self-reactivable in V1 if that 30-day window elapses without reactivation
- if a user is the last admin of a non-personal workspace, require them to promote another member to admin before account closure can proceed
- retain the personal workspace during V1 closure and do not delete it as part of the normal V1 closure flow
- keep transcript transfer into a personal workspace out of scope for V1
- treat eventual permanent account deletion and any creator-attribution cleanup as separate later policy work

Important implication:

- account-lifecycle work must keep the V1 closed-account state separate from any later permanent-deletion policy
- any existing OpenSpec work that assumed immediate permanent deletion or deletion at the end of the 30-day window needed retargeting
- creator-attribution cleanup after any future permanent account deletion remains follow-up policy work rather than part of the V1 closure contract

## Recommended Change Structure

Recommended new foundational change:

- `add-workspace-foundation`

Recommended possible additional change:

- `add-transcript-edit-sessions`

Reason for a separate edit-session change:

- locking, autosave, expiry, redirect behavior, Redis state, and conflict handling are substantial enough to stand on their own
- keeping all of that inside `add-transcript-curation-controls` would likely make that change too broad

## Expected Impact On Existing Changes

The conversation concluded that these existing changes likely need retargeting:

### Strongly impacted

- `openspec/changes/add-web-meeting-processing/`
- `openspec/changes/add-transcript-management/`
- `openspec/changes/add-transcript-curation-controls/`
- `openspec/changes/add-public-transcript-sharing/`
- `openspec/changes/add-client-side-transcript-export/`
- `openspec/changes/add-account-security-hardening/`

### Likely less impacted

- `openspec/changes/add-meeting-processing-foundation/`
- `openspec/changes/add-federated-and-passwordless-auth/`
- `openspec/changes/add-auth-localization-foundation/`

## Retargeting Direction Per Change

### `add-web-meeting-processing`

Shift from:

- transcript belongs to one user

Toward:

- transcript belongs to one workspace
- transcript keeps author attribution via `createdByUserId`

### `add-transcript-management`

Shift from:

- owner-scoped library and detail reads

Toward:

- workspace-scoped library and detail reads based on membership role

### `add-transcript-curation-controls`

Shift from:

- owner-only mutation model

Toward:

- role-based workspace mutation model
- `member` deletion remains creator-scoped only while creator attribution still resolves to that member
- `admin` can delete any retained record in the workspace, including records that are no longer creator-deletable under the member rule
- plus likely extraction of edit locking/autosave into a dedicated follow-up capability

### `add-public-transcript-sharing`

Shift from:

- owner-managed public sharing

Toward:

- workspace member-managed public sharing

### `add-client-side-transcript-export`

Shift from:

- owner-scoped export actions

Toward:

- workspace permission-scoped export actions
- `read_only` members can export because export is treated as a read action

### `add-account-security-hardening`

Needs new handling for:

- account deactivation or closure with a 30-day reactivation window instead of immediate permanent deletion in V1
- last-admin closure flows
- the rule that another member must be promoted to admin before a last admin can close their account
- reactivation using fresh sign-in and fresh second-factor verification when 2FA is enabled
- the relationship between closure semantics and the personal workspace remaining retained during V1 closure

## Recommended Implementation Order

Recommended order discussed during the conversation:

1. keep `bootstrap-meeting-recap-web-platform` as the smaller auth/runtime foundation
2. add `add-workspace-foundation`
3. retarget transcript creation in `add-web-meeting-processing`
4. retarget transcript browsing in `add-transcript-management`
5. introduce transcript mutation semantics under workspace roles
6. optionally split edit sessions into their own change before deeper curation work

## Open Questions

The following questions are still intentionally left open for later OpenSpec artifact work:

- Lock identity and UX details:
  - what exact UI should other users see when a transcript is currently locked for markdown editing?

## Main Takeaways

The strongest conclusions from the conversation were:

- `workspace` should be introduced before transcript-focused implementation gets too far.
- The system should not model this as a simple `user.workspaceId`.
- Memberships need real roles, including `read_only`.
- Transcript collaboration should use role-based workspace permissions plus author attribution.
- Edit locking and autosave are significant enough to treat as a dedicated concern.
- V1 should use account closure with a 30-day self-service reactivation window, not immediate permanent deletion at closure submit time.
- Last-admin closure needs an explicit handoff rule: promote another member to admin first.
- Transcript transfer into the personal workspace should remain out of scope for the V1 account-closure contract.

## Useful Files To Revisit Next Time

- `openspec/changes/add-web-meeting-processing/specs/transcript-data-retention/spec.md`
- `openspec/changes/add-transcript-management/design.md`
- `openspec/changes/add-transcript-curation-controls/design.md`
- `openspec/changes/add-public-transcript-sharing/specs/public-transcript-sharing/spec.md`
- `openspec/changes/add-client-side-transcript-export/specs/client-side-transcript-export/spec.md`
- `openspec/changes/add-account-security-hardening/design.md`

## Best Resume Prompt

If resuming later, a good next prompt would be:

`Use openspec/workspace-collaboration-context-2026-04-16.md as historical context for the workspace exploration, then compare it against the current OpenSpec changes to continue any remaining retargeting work.`
