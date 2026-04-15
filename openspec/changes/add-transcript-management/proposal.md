## Why

The platform, authentication, processing, and retention foundations are now defined, but users still cannot privately browse the transcript records the system creates for them or open one owned record to read its canonical content. This change is needed now because private library and detail surfaces are the minimum transcript product foundation that later curation, sharing, and export work all depend on.

## What Changes

- Add an authenticated private transcript library that lists only the current user's transcript records with summary metadata needed for browsing.
- Add a transcript detail page that renders the canonical transcript and recap markdown for one owned record along with its processing status and privacy-safe metadata.
- Add owner-scoped transcript list and detail read rules so users can only browse records they own, with the same not-found behavior for missing and foreign records.
- Keep the backend-to-frontend contract markdown-first for reading: the backend remains the source of truth for canonical markdown fields, and the frontend renders markdown without switching to HTML-based storage.
- Define the library query strategy as server-side search, baseline status filtering, baseline title/time sorting, and cursor-based pagination with an explicit "Load more" interaction rather than infinite scroll.
- Define dedicated loading, empty, no-results, not-found, and recoverable fetch-error states for the library and detail surfaces.

## Capabilities

### New Capabilities
- `private-transcript-library`: Authenticated transcript library browsing, transcript detail viewing, owner-scoped read authorization, summary/detail projections, baseline search and organization controls, pagination, and explicit UI states for private transcript records.

### Modified Capabilities
- None.

## Impact

- `app/` gains the first persistent private post-processing product surfaces: transcript library and transcript detail views.
- The Next.js web runtime must add owner-scoped transcript list and detail read endpoints plus baseline search, status filter, sort, and pagination behavior.
- Postgres transcript persistence must support efficient owner-scoped library queries over durable processing outputs without adding write-side curation fields in this change.
- The frontend must render canonical transcript and recap markdown read-only, while follow-up transcript curation work can later add rename, editing, tagging, and delete controls on top of the same surfaces.
