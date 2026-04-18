## 1. Read-Side Query Foundations

- [x] 1.1 Extend transcript query support and any supporting indexes needed for workspace-scoped search, baseline `displayTitle`/time sorting, status filtering, and cursor pagination using the current-workspace contract from `add-workspace-foundation`.
- [x] 1.2 Implement transcript repository/service helpers that scope library and detail reads by `workspaceId` plus current-user read access.

## 2. Server-Side Library And Detail APIs

- [x] 2.1 Implement the current-workspace transcript library read surface with summary projections only, including stable `displayTitle`.
- [x] 2.2 Implement server-side search, baseline `displayTitle`/time sort, status filter, and cursor-based pagination with explicit `nextCursor` support for the library.
- [x] 2.3 Implement the current-workspace transcript detail read surface that returns `displayTitle`, canonical markdown fields, and privacy-safe transcript metadata.

## 3. Transcript Library And Detail UI

- [x] 3.1 Build the authenticated transcript library page in `app/` with summary cards or rows for transcript records in the current workspace using `displayTitle`.
- [x] 3.2 Add library search, baseline `displayTitle`/time sort controls, status filtering, and the explicit "Load more" interaction.
- [x] 3.3 Add dedicated library loading, empty, no-results, and fetch-error states with retry behavior.
- [x] 3.4 Build the transcript detail page that renders `displayTitle`, canonical transcript and recap markdown, processing status, and privacy-safe metadata.
- [x] 3.5 Add dedicated detail loading, not-found/unavailable, and fetch-error states with retry behavior.

## 4. Authorization And Regression Coverage

- [x] 4.1 Add automated coverage for active-workspace lockout plus workspace-scoped list and detail reads, including read-capable roles and not-found behavior for transcript IDs outside the current workspace.
- [x] 4.2 Add automated coverage for library search, baseline `displayTitle`/time sort behavior, status filtering, and cursor pagination.
