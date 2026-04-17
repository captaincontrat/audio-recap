## Context

Workspace archival is a cross-cutting lifecycle event. Once a workspace is archived, private transcript access and authenticated export should stop immediately, pending invitations should no longer grant access, public links should no longer resolve, and active markdown editing should shut down cleanly. At the same time, archival cannot race with in-progress upload or transcript-processing work.

Because those side effects span admin actions, processing state, invitation state, public sharing, and edit sessions, the lifecycle deserves its own focused change instead of being folded into workspace foundation.

## Goals / Non-Goals

**Goals:**

- Define an archive-first lifecycle for team workspaces with a 60-day restoration window.
- Block archival while upload or audio-processing work is still in progress.
- Define the immediate product side effects of archival on private transcript surfaces, authenticated export, invitation acceptance, public sharing, and markdown edit sessions.
- Define restoration and delayed permanent deletion behavior for archived team workspaces.

**Non-Goals:**

- Personal-workspace lifecycle changes beyond refusing archive for personal workspaces.
- Invitation issuance rules beyond their archive interaction.
- Public sharing policy outside archive-related availability.
- Account-closure retention rules.
- Transcript transfer between workspaces.

## Decisions

### Decision: Use an archive-first lifecycle with restore window for team workspaces only

Normal workspace lifecycle for team workspaces is:

1. archive
2. restore within 60 days if needed
3. permanently delete only after the 60-day window elapses without restore

Personal workspaces are outside this lifecycle and are not archived through the normal workspace admin flow.

**Why this over alternatives**

- Over immediate hard delete: the conversation explicitly chose an archive-and-restore model.
- Over applying the same lifecycle to personal workspaces: personal workspaces are intentionally non-deletable in the current product direction.

### Decision: Refuse archival while upload or transcript processing is still active

A workspace cannot be archived while it still has in-progress upload or non-terminal audio-processing work. Archival is allowed only once that work is no longer active.

**Why this over alternatives**

- Over forcing archival and trying to clean up mid-flight work afterward: processing and cleanup guarantees become harder to reason about.
- Over silently cancelling work on archive: the conversation chose a stricter refusal rule instead.

### Decision: Archived workspaces become unavailable immediately for private transcript surfaces and related access paths

Archival is not a soft visual flag. Once archived, the workspace becomes unavailable immediately for private transcript access and related collaboration behavior.

That unavailable state should gate:

- workspace-private transcript library and detail surfaces
- authenticated transcript export
- invitation acceptance
- public share resolution
- transcript markdown autosave acceptance

**Why this over alternatives**

- Over delayed effect after some grace period: admins expect archive to freeze access right away.
- Over leaving private transcript reads or export active while only blocking writes: that would undermine archive as a total lockout for workspace transcript access.
- Over leaving public or invite access active while only hiding private screens: that would undermine the archive model.

### Decision: Archival invalidates invitation links immediately and restoration does not revive them

Pending invitation links are invalidated immediately on archival and remain invalid after restoration. If access still needs to be granted, admins must send fresh invitations.

**Why this over alternatives**

- Over reactivating old links after restore: it would resurrect stale access grants.
- Over keeping pending links valid during archive: it conflicts with the inactive-workspace model.

### Decision: Archival suppresses public share resolution and restore does not reactivate prior public links automatically

Public share URLs for transcripts in an archived workspace do not resolve while the workspace is archived.

If the workspace is later restored, those previously enabled public links still remain unavailable. A `member` or `admin` must perform a fresh share-management action after restore before public sharing becomes active again.

**Why this over alternatives**

- Over leaving share URLs live during archive: public availability would outlast the workspace's active collaboration state.
- Over deleting all share configuration at archive time: a temporary archive should not have to destroy share state to suppress access.
- Over automatically reactivating previously enabled links after restore: it would resume public access without a fresh post-restore decision by a workspace user.

### Decision: Archival releases edit locks and rejects further autosaves

When a workspace is archived:

- existing transcript markdown edit locks are released
- further autosave attempts are rejected
- any pending same-tab refresh reconnection window from `add-transcript-edit-sessions` is cancelled

This keeps the editor aligned with the same archive-is-inactive rule used for invitations and public links.

**Why this over alternatives**

- Over letting active editors continue until timeout: archived workspaces should stop accepting collaborative mutations immediately.
- Over leaving locks stranded until their natural TTL expiry: that produces confusing stale-lock behavior after restore.
- Over letting a refreshed tab reclaim the old edit session after archive: archive should win over any transient reconnect behavior.

## Risks / Trade-offs

- [Archival can be blocked by long-running or stuck processing work] -> Define clear active-processing states and make operators resolve them before archive.
- [Many side effects must happen together when archive occurs] -> Treat archive as a single server-owned lifecycle transition with explicit downstream invalidation steps.
- [Users may be surprised that archived workspaces immediately cut off links and editor sessions] -> Keep the admin confirmation flow explicit about the immediate side effects.

## Migration Plan

1. Add durable archive, restore, and scheduled-deletion timestamps for team workspaces.
2. Add archive eligibility checks that refuse archive when upload or non-terminal processing is active.
3. Gate workspace-private transcript surfaces, authenticated export, invitation acceptance, and public share resolution on archive state.
4. Release edit locks and reject archived-workspace autosaves as part of the archive transition.
5. Add restore handling, post-restore requirements for fresh public-share management, and delayed permanent deletion after the 60-day window.

Rollback strategy:

- archive flags can remain durable even if some secondary side effects are temporarily feature-flagged off
- if automatic delayed deletion is withdrawn, archived workspaces can remain archived until the deletion path is restored

## Open Questions

- None.
