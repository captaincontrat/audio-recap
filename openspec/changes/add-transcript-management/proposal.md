## Why

The platform, authentication, workspace, processing, and retention foundations are now defined, but users still cannot privately browse the durable transcript records available in their current workspace or open one workspace-scoped record to read its canonical content. This change is needed now because the durable private library and detail read surfaces are the minimum transcript product foundation that later curation, sharing, and export work all depend on.

## What Changes

- Add an authenticated private transcript library that lists transcript records in the current workspace with summary metadata needed for browsing, including stable `displayTitle`.
- Add a transcript detail page that renders the canonical transcript and recap markdown for one transcript record in the current workspace along with its `displayTitle`, processing status, and privacy-safe metadata.
- Define `displayTitle` as the stable read-side title contract for the durable transcript library/detail surfaces, while leaving write-side title-input calculation to follow-up curation rules.
- Add workspace-scoped transcript list and detail read rules so users with read access in the current workspace can browse records there, with the same not-found behavior for missing and out-of-workspace records.
- Keep the backend-to-frontend contract markdown-first for reading: the backend remains the source of truth for canonical markdown fields, and the frontend renders markdown without switching to HTML-based storage.
- Define the library query strategy as server-side search, baseline status filtering, baseline `displayTitle`/time sorting, and cursor-based pagination with an explicit "Load more" interaction rather than infinite scroll.
- Define dedicated loading, empty, no-results, not-found, and recoverable fetch-error states for the library and detail surfaces.

## Capabilities

### New Capabilities
- `private-transcript-library`: Authenticated transcript library browsing, transcript detail viewing, stable `displayTitle` read projections, workspace-scoped read authorization, summary/detail projections, baseline search and organization controls, pagination, and explicit UI states for private transcript records.

### Modified Capabilities
- None.

## Impact

- `app/` gains the durable private post-processing read surfaces for the current workspace: transcript library and transcript detail views.
- The Next.js web runtime must add current-workspace transcript list and detail read endpoints plus baseline search, status filter, `displayTitle`/time sort, and pagination behavior.
- The web runtime depends on `add-workspace-foundation` for current-workspace resolution and read-access checks, and on `add-workspace-archival-lifecycle` for the active-workspace requirement that locks archived workspaces out of these surfaces.
- Postgres transcript persistence must support efficient workspace-scoped library queries over durable transcript data and the stable `displayTitle` read contract without taking on write-side curation behavior in this change.
- The frontend must render `displayTitle`, canonical transcript markdown, and recap markdown read-only, while follow-up transcript curation work can later add rename, editing, tagging, and delete controls on top of the same surfaces.
