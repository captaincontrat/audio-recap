## 1. Client-Side Export Infrastructure

- [ ] 1.1 Add frontend export helpers that assemble one canonical export document from display title, recap markdown, and transcript markdown, then parse it with `unified`, `remark-parse`, and `remark-gfm`.
- [ ] 1.2 Implement local conversion of the assembled export document into `md` and `txt`, using direct markdown download for `md` and `mdast-util-to-string` for `txt`.
- [ ] 1.3 Implement local conversion of the assembled export document into `pdf` and `docx` using `remark-pdf` and `remark-docx`.
- [ ] 1.4 Add export error handling so failed client-side conversion surfaces a user-visible error without mutating transcript content.

## 2. Authenticated Export UX

- [ ] 2.1 Add workspace-scoped export actions to authenticated transcript-management surfaces for completed transcripts with read access, including `read_only`, only while the workspace is active under `add-workspace-archival-lifecycle`.
- [ ] 2.2 Ensure export actions consume canonical backend markdown rather than backend-generated files or HTML payloads.
- [ ] 2.3 Add download naming based on the current display title and selected export format.

## 3. Regression Coverage

- [ ] 3.1 Add automated coverage for workspace-scoped export authorization, `read_only` export access, completed-only export gating, archive-state export refusal, and public-page absence of export controls.
- [ ] 3.2 Add automated coverage for client-side export assembly and conversion across `md`, `txt`, `pdf`, and `docx`, including the selected `remark`-based export pipeline.
