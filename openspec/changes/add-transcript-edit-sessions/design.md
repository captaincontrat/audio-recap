## Context

The workspace collaboration model allows members and admins to edit shared transcripts, but the conversation explicitly rejected true real-time collaborative editing for V1. Instead, transcript markdown editing needs member/admin-only session acquisition, one coordinated edit session at a time, autosave after short inactivity, and deterministic behavior when a lock is lost.

This change isolates those session-management rules from general transcript curation so that rename, tagging, important state, delete behavior, and share actions do not have to carry lock infrastructure in the same scope.

## Goals / Non-Goals

**Goals:**

- Define one active markdown edit session per transcript.
- Define workspace-role requirements for acquiring a markdown edit session.
- Limit the edit lock to `transcriptMarkdown` and `recapMarkdown`.
- Define autosave timing and lock renewal behavior.
- Define timeout and conflict behavior when the lock expires or is lost.
- Define the user-facing exit behavior when an edit session can no longer continue.

**Non-Goals:**

- Real-time collaborative editing or CRDT-style merge behavior.
- Locking metadata-only actions such as rename, tags, important markers, or share controls.
- Local draft backup or offline recovery after lock loss.
- Version history or change timeline behavior.
- Workspace archival policy or archive-triggered side effects; those stay with `add-workspace-archival-lifecycle`, which this change depends on for active-workspace gating.

## Decisions

### Decision: Allow only one active markdown edit session per transcript

The system uses one exclusive edit lock per transcript. A second user cannot enter markdown edit mode while that lock is active. The same user opening another tab also conflicts with the active session instead of receiving a shared multi-tab lock.

**Why this over alternatives**

- Over lock-per-field-group: transcript and recap markdown are edited together as one content-editing concern.
- Over allowing same-user multi-tab sharing: it creates race conditions between tabs that are hard to explain and recover from cleanly.

### Decision: Allow markdown edit-session acquisition only for `member` and `admin` users in the current workspace

Markdown edit sessions are write-capable collaboration behavior, so acquisition is limited to users whose current-workspace role is `member` or `admin`. For workspace-scoped private edit routes, the explicit workspace route context from `add-workspace-foundation` is authoritative; session or remembered state may help choose a default entry route when no workspace is explicit, but must not override the route-selected workspace. A `read_only` workspace user cannot enter markdown edit mode.

This change also depends on the active-workspace rule from `add-workspace-archival-lifecycle`: if the current workspace is archived, edit-session acquisition must be refused without redefining archive-side effects here.

**Why this over alternatives**

- Over allowing `read_only` users to acquire markdown edit sessions: transcript markdown editing is a mutation surface, not a read surface.
- Over duplicating archive behavior here: `add-workspace-archival-lifecycle` is the normative owner of archived-workspace lockout and archive-triggered side effects.

### Decision: Scope the lock to markdown content only

The lock protects only:

- `transcriptMarkdown`
- `recapMarkdown`

Metadata-only actions stay outside the markdown lock so the workspace does not feel blocked for lightweight actions.

**Why this over alternatives**

- Over locking the entire transcript record: rename, tags, important state, and share controls would become unnecessarily serial.
- Over separate locks for transcript and recap: that would complicate one editing surface without solving the underlying coordination problem.

### Decision: Renew the session on successful autosave, not on keystroke alone

Autosave is the durability boundary. The edit lock lifetime is renewed when the server accepts an autosave, not simply when the browser sees local typing.

Autosave behavior is:

- debounce about 1 second after markdown changes
- successful autosave extends the lock
- 20 minutes of no successful save ends the session

**Why this over alternatives**

- Over renewing on every local input: the server would not know whether the browser still owns a durable session.
- Over requiring explicit manual saves only: the conversation explicitly chose automatic save behavior.

### Decision: Use Redis-backed TTL locks with server-enforced conflict handling

The platform already expects Redis, and transcript edit locks are ephemeral coordination state. Redis TTL-backed locks fit that problem well, while Postgres remains the durable store for saved markdown.

If a save arrives after the lock has expired or been replaced, the server returns a conflict-style failure and the client exits edit mode.

**Why this over alternatives**

- Over storing edit locks durably in Postgres: the locks are short-lived coordination state, not durable product content.
- Over client-only lock enforcement: multiple browsers would still race.

### Decision: Same-tab refresh may resume the existing edit session briefly

A browser refresh of the same tab is treated as a short reconnection attempt for the existing edit session rather than as a second concurrent editor. For about 10 seconds after the refresh, the client may resume that session only if it presents the same tab-scoped edit-session identity that originally acquired the lock. That identity must survive a reload in the same tab without being shared across different tabs.

On successful resume:

- the session continues without granting a second lock
- the editor reloads the last successfully saved markdown from the server
- unsaved local keystrokes since the last successful autosave are not recovered

If resume does not complete within the reconnection window, or the lock has been lost or replaced, or the workspace has been archived, the client follows the normal lock-loss path instead of entering a degraded editor state.

**Why this over alternatives**

- Over treating refresh as a conflicting second session: accidental reloads would feel harsher than the underlying lock model requires.
- Over resuming based only on user identity: that would let another tab bypass the one-session rule.
- Over restoring unsaved local text after refresh: the conversation explicitly chose not to provide temporary draft recovery after lock loss.

### Decision: On lock loss, force exit and show explicit messaging without local draft recovery

If the edit session expires or is otherwise lost, the user experience is intentionally strict:

- exit edit mode
- redirect away from the active editor state
- show an explicit lock-expired message
- do not offer a temporary local draft recovery flow

**Why this over alternatives**

- Over keeping the user in a degraded editor state: that makes it unclear what is still safe to save.
- Over local draft recovery: the conversation explicitly chose not to preserve temporary unsaved draft state after lock loss.

## Risks / Trade-offs

- [Users can lose the latest unsaved keystrokes if lock loss happens before autosave succeeds] -> Keep the autosave delay short and make the lock-expired state explicit.
- [Same-user multi-tab conflicts can feel surprising] -> Prefer one deterministic lock rule over ambiguous cross-tab merging behavior.
- [Supporting same-tab refresh resume adds reconnect-state complexity] -> Keep the window short and require the original tab-scoped edit-session identity.
- [Redis lock infrastructure introduces another failure mode] -> Treat Redis as coordination-only and keep Postgres as the durable content source.
- [This change depends on archive-aware workspace activity checks] -> Reuse `add-workspace-archival-lifecycle` for active-workspace gating instead of redefining archive side effects inside edit sessions.

## Migration Plan

1. Add Redis-backed lock primitives and conflict-aware transcript markdown save handling.
2. Add client edit-session state that enters markdown edit mode only after the lock is acquired and keeps a tab-scoped edit-session identity for the life of that tab.
3. Add same-tab refresh resume with an about 10-second reconnection window that reloads the last successfully saved markdown from the server on resume.
4. Add autosave with approximately one-second debounce and lock renewal on each successful save.
5. Add lock-loss handling that exits edit mode and shows explicit messaging.
6. Integrate the active-workspace requirement from `add-workspace-archival-lifecycle` into edit-session entry and save eligibility without redefining archive-triggered lock release or autosave rejection here.

Rollback strategy:

- withdraw the markdown editor if lock handling proves unstable while preserving read-only transcript access and metadata-only curation
- keep Redis lock data ephemeral so rollback does not require durable cleanup

## Open Questions

- What exact UI should another user see when a transcript is currently locked for markdown editing?
