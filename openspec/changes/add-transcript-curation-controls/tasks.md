## 1. Transcript Curation Data Model

- [ ] 1.1 Extend the transcript persistence model to support `customTitle`, tags, important flag, and any supporting derived tag sort keys, search fields, or indexes needed for workspace curation queries.
- [ ] 1.2 Implement transcript repository and service helpers that scope every curation write by workspace membership while keeping creator attribution available for delete authorization.
- [ ] 1.3 Add validation rules for rename, tag normalization and limits, important toggle, and creator or admin delete behavior, including deleted-creator fallback to admin-only deletion.

## 2. Server-Side Curation APIs

- [ ] 2.1 Implement the transcript patch surface for `customTitle`, tags, and important updates with workspace `member` and `admin` authorization plus the active-workspace gate from `add-workspace-archival-lifecycle`.
- [ ] 2.2 Extend workspace transcript library queries with important-state sorting and filtering plus tag-aware sorting and selected-tag filtering.
- [ ] 2.3 Implement the transcript delete surface with creator or admin rules, deleted-creator fallback behavior, not-found behavior for missing or out-of-workspace records, and active-workspace gating.

## 3. Transcript Metadata Curation UI

- [ ] 3.1 Add rename controls that write `customTitle` and rely on the stable `displayTitle` read contract from `add-transcript-management`, using the curation rule `customTitle ?? title`.
- [ ] 3.2 Add tag editing and important-toggle controls to the workspace transcript library and detail surfaces for permitted roles.
- [ ] 3.3 Add transcript deletion confirmation UX that reflects creator or admin delete rules plus deleted-creator fallback behavior and removes deleted records from subsequent workspace library and detail views.

## 4. Authorization And Regression Coverage

- [ ] 4.1 Add automated coverage for transcript patch operations, including rename, tag normalization, important toggling across workspace roles, and active-workspace lockout.
- [ ] 4.2 Add automated coverage for important-state and tag-aware library sort and filter behavior.
- [ ] 4.3 Add automated coverage for transcript deletion, including member-owned deletion, admin deletion, deleted-creator fallback behavior, active-workspace lockout, and workspace not-found behavior for out-of-workspace records.
