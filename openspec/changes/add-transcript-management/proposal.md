## Why

The platform, authentication, processing, and retention foundations are now defined, but users still cannot actually find, review, organize, or correct the transcript records the system creates for them. This change is needed now because transcript management is the core day-two product surface that makes the durable transcript record usable before public sharing and export are layered on top.

## What Changes

- Add an authenticated transcript library that lists only the current user's transcript records and supports search plus server-side organization controls, including time/title sorting, important-state sorting, tag-aware sorting, filtering, loading, empty, and error states.
- Add a transcript detail page that renders the canonical transcript and recap markdown for one owned record and exposes the record's status, tags, importance, and management actions.
- Add management actions for rename, edit transcript markdown, edit recap markdown, delete with confirmation, tag management, and mark/unmark important.
- Define ownership and authorization rules so users can only list, read, update, or delete their own transcript records.
- Keep the backend-to-frontend contract markdown-first: the backend remains the source of truth for canonical markdown fields, and the frontend renders and edits markdown rather than switching to HTML-based storage.
- Define the library list strategy as cursor-based pagination with an explicit "Load more" interaction rather than infinite scroll.

## Capabilities

### New Capabilities
- `transcript-management`: Authenticated transcript library browsing, transcript detail viewing, title and markdown editing, delete confirmation, tags, important toggle, search, sort, filter, pagination, UI states, and ownership/authorization rules for transcript records.

### Modified Capabilities
- None.

## Impact

- `app/` gains the first persistent post-processing product surfaces: transcript library and transcript detail views.
- The Next.js web runtime must add transcript list, detail, update, tag, important-toggle, search/filter/sort, and delete endpoints with ownership enforcement, including explicit important-state and tag-aware library sorting behavior.
- Postgres transcript persistence must support user-managed title changes, tags, importance, searchability, derived tag sort keys, and efficient library pagination.
- The frontend must render and submit canonical markdown for transcript and recap editing without changing the markdown-first backend contract.
