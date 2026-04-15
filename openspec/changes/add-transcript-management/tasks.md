## 1. Read-Side Query Foundations

- [ ] 1.1 Extend transcript query support and any supporting indexes needed for owner-scoped search, baseline title/time sorting, status filtering, and cursor pagination.
- [ ] 1.2 Implement transcript repository/service helpers that scope library and detail reads by owner user ID.

## 2. Server-Side Library And Detail APIs

- [ ] 2.1 Implement the owner-scoped transcript library read surface with summary projections only.
- [ ] 2.2 Implement server-side search, baseline sort, status filter, and cursor-based pagination with explicit `nextCursor` support for the library.
- [ ] 2.3 Implement the owner-scoped transcript detail read surface that returns canonical markdown fields plus privacy-safe transcript metadata.

## 3. Transcript Library And Detail UI

- [ ] 3.1 Build the authenticated transcript library page in `app/` with summary cards or rows for owned transcript records.
- [ ] 3.2 Add library search, baseline sort controls, status filtering, and the explicit "Load more" interaction.
- [ ] 3.3 Add dedicated library loading, empty, no-results, and fetch-error states with retry behavior.
- [ ] 3.4 Build the transcript detail page that renders canonical transcript and recap markdown plus processing status and privacy-safe metadata.
- [ ] 3.5 Add dedicated detail loading, not-found/unavailable, and fetch-error states with retry behavior.

## 4. Authorization And Regression Coverage

- [ ] 4.1 Add automated coverage for owner-scoped list and detail reads, including not-found behavior for foreign transcript IDs.
- [ ] 4.2 Add automated coverage for library search, baseline sort behavior, status filtering, and cursor pagination.
