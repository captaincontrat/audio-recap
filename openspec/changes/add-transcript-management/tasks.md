## 1. Transcript Management Data Model

- [ ] 1.1 Extend the transcript persistence model to support user-managed title overrides, tags, important flag, and any supporting search fields, tag sort keys, or indexes needed for management queries.
- [ ] 1.2 Implement transcript repository/service helpers that scope every management read and write by owner user ID.
- [ ] 1.3 Add validation rules for rename, markdown editing, tag normalization and limits, important toggle, and transcript deletion.

## 2. Server-Side Library And Detail APIs

- [ ] 2.1 Implement the owner-scoped transcript library read surface with summary projections only.
- [ ] 2.2 Implement server-side search, sort, filter, and cursor-based pagination with explicit `nextCursor` support for the library, including important-state sorting and tag-aware sorting.
- [ ] 2.3 Implement the owner-scoped transcript detail read surface that returns canonical markdown fields and management metadata.
- [ ] 2.4 Implement the transcript patch surface for title, markdown, tags, and important updates, including status-based markdown edit restrictions.
- [ ] 2.5 Implement the transcript delete surface with owner scoping and not-found behavior for missing or foreign records.

## 3. Transcript Library UI

- [ ] 3.1 Build the authenticated transcript library page in `app/` with summary cards or rows for owned transcript records.
- [ ] 3.2 Add library search, sort controls including important-state and tag-aware sorting, status and tag filters, important-state filtering, and the explicit "Load more" interaction.
- [ ] 3.3 Add dedicated library loading, empty, no-results, and fetch-error states with retry behavior.

## 4. Transcript Detail And Management UI

- [ ] 4.1 Build the transcript detail page that renders canonical transcript and recap markdown plus status and management metadata.
- [ ] 4.2 Add rename, tag editing, and important-toggle controls for owned transcript records.
- [ ] 4.3 Add markdown-first editing flows for transcript and recap content, including restrictions for non-completed records.
- [ ] 4.4 Add transcript deletion confirmation UX and remove deleted records from subsequent library and detail views.
- [ ] 4.5 Add dedicated detail loading, not-found/unavailable, and fetch-error states with retry behavior.

## 5. Authorization And Regression Coverage

- [ ] 5.1 Add automated coverage for owner-scoped list and detail reads, including not-found behavior for foreign transcript IDs.
- [ ] 5.2 Add automated coverage for transcript patch operations, including rename, markdown edits, tag normalization, and important toggling.
- [ ] 5.3 Add automated coverage for library search, important-state and tag-aware sort behavior, filter behavior, and cursor pagination.
- [ ] 5.4 Add automated coverage for transcript deletion and the confirmation-driven management flow.
