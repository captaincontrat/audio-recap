## Why

`add-web-meeting-processing` created the durable transcript record and the reduced `add-transcript-management` change now defines the private library and detail read surfaces, but users still cannot organize, correct, or remove the records they own. This change is needed now because private transcript curation is the remaining owner-only product surface required before sharing and export can layer on top cleanly.

## What Changes

- Add owner-driven transcript curation for rename, transcript markdown editing, recap markdown editing, delete with confirmation, tag management, and important toggle.
- Preserve the processing-owned transcript title while adding a nullable `customTitle` override so the user-visible display title becomes `customTitle ?? title`.
- Add one owner-scoped patch surface for non-destructive updates to `customTitle`, `transcriptMarkdown`, `recapMarkdown`, `tags`, and `isImportant`.
- Limit transcript and recap markdown editing to records in `completed` status.
- Extend the private transcript library with important-state and tag-aware organization controls, including sorting and filtering behavior.
- Keep the backend-to-frontend contract markdown-first: canonical transcript and recap content remain markdown in storage and over the API.

## Capabilities

### New Capabilities
- `transcript-curation-controls`: Owner-scoped transcript rename, markdown editing, delete confirmation, tags, important toggle, metadata-rich library organization controls, and write-side ownership rules for private transcript records.

### Modified Capabilities
- None.

## Impact

- The Next.js web runtime must add transcript patch and delete endpoints with owner scoping, completed-only markdown edit rules, and not-found behavior for missing or foreign records.
- Postgres transcript persistence must support `customTitle`, tags, important state, and any supporting derived sort or search fields needed for important and tag-aware library organization.
- `app/` must add rename, tag, important-toggle, markdown editing, and delete confirmation controls on top of the private transcript surfaces introduced by the reduced management change.
- Automated coverage must expand beyond read-only transcript access to cover owner-scoped mutations, metadata normalization, destructive actions, and important/tag organization behavior.
