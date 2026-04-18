## Why

`add-web-meeting-processing` created the durable transcript record and the reduced `add-transcript-management` change defines the transcript library and detail read surfaces, but the workspace collaboration model still needs lightweight curation controls for shared transcript records. This change is needed now because rename, tags, important state, library organization, and delete behavior remain the write-side transcript surface required before sharing and export can layer on top cleanly, while markdown editing has now moved to `add-transcript-edit-sessions`.

## What Changes

- Add workspace-scoped transcript curation for rename, delete with confirmation, tag management, and important toggle.
- Preserve the processing-owned transcript title while adding a nullable `customTitle` override so the user-visible display title becomes `customTitle ?? title`.
- Add one workspace-scoped patch surface for non-destructive updates to `customTitle`, `tags`, and `isImportant`.
- Allow workspace `member` and `admin` roles to rename, tag, and mark important on any transcript in the workspace.
- Allow a workspace `member` to delete only transcripts whose creator attribution still resolves to that member, and a workspace `admin` to delete any transcript in the workspace, including retained records whose creator account was later deleted.
- Extend the workspace transcript library with important-state and tag-aware organization controls, including sorting and filtering behavior.
- Keep markdown edit sessions out of scope here; `add-transcript-edit-sessions` owns `transcriptMarkdown` and `recapMarkdown` editing, lock, autosave, expiry, and conflict behavior.

## Capabilities

### New Capabilities
- `transcript-curation-controls`: Workspace-scoped transcript rename, delete confirmation, tags, important toggle, metadata-rich library organization controls, and role-based write rules for transcript records.

### Modified Capabilities
- None.

## Impact

- The Next.js web runtime must add transcript patch and delete endpoints with workspace role scoping, creator-aware delete rules including deleted-creator fallback behavior, and not-found behavior for missing or out-of-workspace records.
- Postgres transcript persistence must support `customTitle`, tags, important state, and any supporting derived sort or search fields needed for important and tag-aware library organization.
- `app/` must add rename, tag, important-toggle, and delete confirmation controls on top of the workspace transcript surfaces introduced by the reduced management change, while markdown edit flows are implemented separately by `add-transcript-edit-sessions`.
- Automated coverage must expand beyond read-only transcript access to cover workspace-scoped mutations, metadata normalization, destructive actions, and important or tag-aware organization behavior.
