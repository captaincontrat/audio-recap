## Why

Workspace archival affects much more than a single status field: it changes access, invitation validity, public share availability, edit-session behavior, and what can happen to in-flight processing work. Treating archival as a dedicated lifecycle change keeps these cross-cutting shutdown rules consistent without bloating the workspace foundation.

## What Changes

- Add an archive-first workspace lifecycle with a 60-day restoration window before permanent deletion.
- Block workspace archival while an upload or audio-processing job is still in progress for that workspace.
- Make archived workspaces unavailable immediately for workspace-private transcript surfaces, authenticated export, and collaboration flows.
- Invalidate public share links and pending invitation links immediately when a workspace is archived, and require fresh public-share management after restore.
- Release existing markdown edit locks and reject further autosaves while a workspace remains archived.

## Capabilities

### New Capabilities
- `workspace-archival-lifecycle`: Workspace archive, restore, delayed deletion, and the immediate side effects archival has on private transcript access, authenticated export, invitations, public links, and edit sessions.

### Modified Capabilities
- None.

## Impact

- Postgres will need durable workspace archival and restoration timestamps.
- Archival checks will need to coordinate with transcript processing and upload lifecycle state.
- Private transcript surfaces, authenticated export, public share resolution, invitation acceptance, and edit-session handling will need archive-aware behavior.
- Admin UI and APIs will need restore-window awareness rather than a simple destructive delete flow.
