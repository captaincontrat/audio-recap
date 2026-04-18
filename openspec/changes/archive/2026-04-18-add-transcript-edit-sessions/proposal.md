## Why

Workspace members can edit shared transcript markdown, but locking, autosave, expiration, and conflict handling are coordination concerns rather than simple transcript curation. Keeping them separate prevents transcript curation from becoming a large mixed change that bundles content edits with session-management infrastructure.

## What Changes

- Add exclusive markdown edit sessions with one active lock per transcript.
- Add autosave with an approximately one-second debounce after markdown changes.
- Renew the edit lock on each successful autosave and expire it 20 minutes after the last successful save.
- Force exit from edit mode when the lock expires or is lost, with explicit user messaging and no temporary local draft recovery.
- Scope edit locking to `transcriptMarkdown` and `recapMarkdown` only, leaving metadata-only actions outside the markdown edit lock.

## Capabilities

### New Capabilities
- `transcript-edit-sessions`: Exclusive markdown edit locks, autosave timing, timeout behavior, and client/server conflict handling for transcript editing.

### Modified Capabilities
- None.

## Impact

- Transcript detail editing UX will need explicit edit-session state and expiration handling.
- Redis-backed ephemeral locking becomes a user-facing coordination dependency.
- Transcript save APIs will need autosave-aware conflict behavior instead of assuming stateless updates.
- Workspace archival behavior will need to release edit sessions cleanly.
