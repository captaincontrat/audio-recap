## 1. Read-Side Query Foundations

- [ ] 1.1 Extend transcript query support and any supporting indexes needed for workspace-scoped search, baseline `displayTitle`/time sorting, status filtering, and cursor pagination using the current-workspace contract from `add-workspace-foundation`.
- [ ] 1.2 Implement transcript repository/service helpers that scope library and detail reads by `workspaceId` plus current-user read access.

## 2. Server-Side Library And Detail APIs

- [ ] 2.1 Implement the current-workspace transcript library read surface with summary projections only, including stable `displayTitle`.
- [ ] 2.2 Implement server-side search, baseline `displayTitle`/time sort, status filter, and cursor-based pagination with explicit `nextCursor` support for the library.
- [ ] 2.3 Implement the current-workspace transcript detail read surface that returns `displayTitle`, canonical markdown fields, and privacy-safe transcript metadata.

## 3. Transcript Library And Detail UI

- [ ] 3.1 Build the authenticated transcript library page in `app/` with summary cards or rows for transcript records in the current workspace using `displayTitle`.
- [ ] 3.2 Add library search, baseline `displayTitle`/time sort controls, status filtering, and the explicit "Load more" interaction.
- [ ] 3.3 Add dedicated library loading, empty, no-results, and fetch-error states with retry behavior.
- [ ] 3.4 Build the transcript detail page that renders `displayTitle`, canonical transcript and recap markdown, processing status, and privacy-safe metadata.
- [ ] 3.5 Add dedicated detail loading, not-found/unavailable, and fetch-error states with retry behavior.

## 4. Authorization And Regression Coverage

- [ ] 4.1 Add automated coverage for active-workspace lockout plus workspace-scoped list and detail reads, including read-capable roles and not-found behavior for transcript IDs outside the current workspace.
- [ ] 4.2 Add automated coverage for library search, baseline `displayTitle`/time sort behavior, status filtering, and cursor pagination.
