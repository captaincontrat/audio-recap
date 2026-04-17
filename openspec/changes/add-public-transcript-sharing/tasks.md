## 1. Share State And Server Foundations

- [ ] 1.1 Extend the transcript persistence model to support share-enabled state, stable public share IDs, and active rotatable share secrets.
- [ ] 1.2 Implement workspace-scoped share enable, disable, and rotate actions with `member`/`admin` role enforcement, `read_only` refusal, completed-only validation for shareable transcripts, and current share state in workspace-scoped transcript summary/detail projections.
- [ ] 1.3 Implement the public read-only share route that resolves transcripts by double-UUID URL and returns privacy-minimal transcript data only.
- [ ] 1.4 Implement generic unavailable behavior for missing, disabled, rotated, deleted, or otherwise invalid public links in active workspaces, and integrate lifecycle-driven public-link availability with `add-workspace-archival-lifecycle`.

## 2. Public Sharing UI

- [ ] 2.1 Add share-management controls to authenticated transcript-management surfaces for enabling, disabling, copying, and rotating public links for `member` and `admin` users in active workspaces, plus workspace-visible share-state indicators and shared/unshared organization controls in the private library.
- [ ] 2.2 Build the public read-only transcript page that renders only the display title, recap markdown, and transcript markdown.
- [ ] 2.3 Ensure the public share page never exposes private workspace metadata, management controls, or export actions, and ensure `read_only` transcript browsers do not receive share-management controls.

## 3. Regression Coverage

- [ ] 3.1 Add automated coverage for role-based share authorization, `read_only` denial, share enable, disable, rotate, double-UUID link resolution, and private-library shared/unshared sort and filter behavior.
- [ ] 3.2 Add automated coverage for privacy-minimal public rendering, generic unavailable behavior for invalid links, and lifecycle integration with `add-workspace-archival-lifecycle` for archive-driven public-link availability.
