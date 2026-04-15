## 1. Share State And Server Foundations

- [ ] 1.1 Extend the transcript persistence model to support share-enabled state, stable public share IDs, and active rotatable share secrets.
- [ ] 1.2 Implement owner-scoped share enable, disable, and rotate actions with completed-only validation for shareable transcripts, and expose current share state in owner-scoped transcript summary/detail projections.
- [ ] 1.3 Implement the public read-only share route that resolves transcripts by double-UUID URL and returns privacy-minimal transcript data only.
- [ ] 1.4 Implement generic unavailable behavior for missing, disabled, rotated, deleted, or otherwise invalid public links.

## 2. Public Sharing UI

- [ ] 2.1 Add share-management controls to authenticated transcript-management surfaces for enabling, disabling, copying, and rotating public links, plus owner-only share-state indicators and shared/unshared organization controls in the private library.
- [ ] 2.2 Build the public read-only transcript page that renders only the display title, recap markdown, and transcript markdown.
- [ ] 2.3 Ensure the public share page never exposes owner-only metadata, management controls, or export actions.

## 3. Client-Side Export Infrastructure

- [ ] 3.1 Add frontend export helpers that assemble one canonical export document from display title, recap markdown, and transcript markdown.
- [ ] 3.2 Implement local conversion of the assembled export document into `md` and `txt`.
- [ ] 3.3 Implement local conversion of the assembled export document into `pdf` and `docx`.
- [ ] 3.4 Add export error handling so failed client-side conversion surfaces a user-visible error without mutating transcript content.

## 4. Authenticated Export UX

- [ ] 4.1 Add owner-scoped export actions to authenticated transcript-management surfaces for completed transcripts only.
- [ ] 4.2 Ensure export actions consume canonical backend markdown rather than backend-generated files or HTML payloads.
- [ ] 4.3 Add download naming based on the current display title and selected export format.

## 5. Regression Coverage

- [ ] 5.1 Add automated coverage for share enable, disable, rotate, double-UUID link resolution, and private-library shared/unshared sort and filter behavior.
- [ ] 5.2 Add automated coverage for privacy-minimal public rendering and generic unavailable behavior for invalid links.
- [ ] 5.3 Add automated coverage for authenticated export authorization, completed-only export gating, and public-page absence of export controls.
- [ ] 5.4 Add automated coverage for client-side export assembly and conversion across `md`, `txt`, `pdf`, and `docx`.
