## 1. Transcript Curation Data Model

- [ ] 1.1 Extend the transcript persistence model to support `customTitle`, tags, important flag, and any supporting derived tag sort keys, search fields, or indexes needed for curation queries.
- [ ] 1.2 Implement transcript repository and service helpers that scope every curation write by owner user ID.
- [ ] 1.3 Add validation rules for rename, markdown editing, tag normalization and limits, important toggle, and transcript deletion.

## 2. Server-Side Curation APIs

- [ ] 2.1 Implement the transcript patch surface for `customTitle`, markdown, tags, and important updates, including status-based markdown edit restrictions.
- [ ] 2.2 Extend private transcript library queries with important-state sorting and filtering plus tag-aware sorting and selected-tag filtering.
- [ ] 2.3 Implement the transcript delete surface with owner scoping and not-found behavior for missing or foreign records.

## 3. Transcript Curation UI

- [ ] 3.1 Add rename controls that compute the display title from `customTitle ?? title`.
- [ ] 3.2 Add tag editing and important-toggle controls to the private transcript library and detail surfaces.
- [ ] 3.3 Add markdown-first editing flows for transcript and recap content, including completed-only restrictions and user-visible save errors.
- [ ] 3.4 Add transcript deletion confirmation UX and remove deleted records from subsequent private library and detail views.

## 4. Authorization And Regression Coverage

- [ ] 4.1 Add automated coverage for transcript patch operations, including rename, markdown edits, tag normalization, and important toggling.
- [ ] 4.2 Add automated coverage for important-state and tag-aware library sort and filter behavior.
- [ ] 4.3 Add automated coverage for transcript deletion and the confirmation-driven management flow.
