## Split Result

The original `add-transcript-sharing-and-exports` scope was split into:

- public sharing: `openspec/changes/add-public-transcript-sharing/`
- client-side export: `openspec/changes/add-client-side-transcript-export/`

Validation check after the split:

- `openspec validate --changes --json --no-interactive`
- result: 9/9 active changes valid

Functional-scope result:

- No original functional requirement was dropped.
- The only intentional artifact-level removal was the single compound change slug `add-transcript-sharing-and-exports`, which was replaced by two smaller active changes:
  - `add-public-transcript-sharing`
  - `add-client-side-transcript-export`

## Proposal Scope Mapping

| Original proposal item | Outcome | New home |
| --- | --- | --- |
| Add owner-controlled public transcript sharing with enable, disable, and secret rotation actions | Moved | `openspec/changes/add-public-transcript-sharing/` |
| Define a double-UUID public URL design for read-only sharing that is difficult to guess and does not expose internal transcript identifiers | Moved | `openspec/changes/add-public-transcript-sharing/` |
| Add privacy-minimal public transcript rendering that exposes only the fields required for a useful shared transcript view | Moved | `openspec/changes/add-public-transcript-sharing/` |
| Extend the authenticated transcript library so owners can see and organize transcripts by public sharing state | Moved | `openspec/changes/add-public-transcript-sharing/` |
| Define access behavior for disabled, rotated, missing, or otherwise invalid public links | Moved | `openspec/changes/add-public-transcript-sharing/` |
| Add authenticated export actions for owned transcripts in `md`, `txt`, `pdf`, and `docx` | Moved | `openspec/changes/add-client-side-transcript-export/` |
| Preserve the markdown-first contract by requiring the backend to send canonical markdown to the frontend and requiring the frontend to perform the export conversion locally | Moved | `openspec/changes/add-client-side-transcript-export/` |

## Design Decision Mapping

| Original design decision | Outcome | New home |
| --- | --- | --- |
| Public sharing is owner-managed and only available for completed transcripts | Moved | `add-public-transcript-sharing/design.md` |
| Use a double-UUID URL with stable public ID and rotatable secret ID | Moved | `add-public-transcript-sharing/design.md` |
| Public sharing state participates in owner-only library organization | Moved | `add-public-transcript-sharing/design.md` |
| Invalid, disabled, missing, and rotated links all resolve to the same public-unavailable behavior | Moved | `add-public-transcript-sharing/design.md` |
| Public rendering is read-only and privacy-minimal | Moved | `add-public-transcript-sharing/design.md` |
| Public shares always render the latest canonical markdown | Moved | `add-public-transcript-sharing/design.md` |
| Exports are authenticated owner actions and are only available for completed transcripts | Moved | `add-client-side-transcript-export/design.md` |
| Export conversion happens entirely on the frontend from canonical markdown | Moved | `add-client-side-transcript-export/design.md` |
| Share and export filenames/links are derived from the display title, but internal state stays separate | Split | Title-independent public URLs move to `add-public-transcript-sharing/design.md`; title-derived download filenames move to `add-client-side-transcript-export/design.md` |

## Task Mapping

| Original task | Outcome | New home |
| --- | --- | --- |
| 1.1 Extend the transcript persistence model to support share-enabled state, stable public share IDs, and active rotatable share secrets | Moved | `add-public-transcript-sharing` 1.1 |
| 1.2 Implement owner-scoped share enable, disable, and rotate actions with completed-only validation for shareable transcripts, and expose current share state in owner-scoped transcript summary/detail projections | Moved | `add-public-transcript-sharing` 1.2 |
| 1.3 Implement the public read-only share route that resolves transcripts by double-UUID URL and returns privacy-minimal transcript data only | Moved | `add-public-transcript-sharing` 1.3 |
| 1.4 Implement generic unavailable behavior for missing, disabled, rotated, deleted, or otherwise invalid public links | Moved | `add-public-transcript-sharing` 1.4 |
| 2.1 Add share-management controls to authenticated transcript-management surfaces for enabling, disabling, copying, and rotating public links, plus owner-only share-state indicators and shared/unshared organization controls in the private library | Moved | `add-public-transcript-sharing` 2.1 |
| 2.2 Build the public read-only transcript page that renders only the display title, recap markdown, and transcript markdown | Moved | `add-public-transcript-sharing` 2.2 |
| 2.3 Ensure the public share page never exposes owner-only metadata, management controls, or export actions | Moved | `add-public-transcript-sharing` 2.3 |
| 3.1 Add frontend export helpers that assemble one canonical export document from display title, recap markdown, and transcript markdown, then parse it with `unified`, `remark-parse`, and `remark-gfm` | Moved | `add-client-side-transcript-export` 1.1 |
| 3.2 Implement local conversion of the assembled export document into `md` and `txt`, using direct markdown download for `md` and `mdast-util-to-string` for `txt` | Moved | `add-client-side-transcript-export` 1.2 |
| 3.3 Implement local conversion of the assembled export document into `pdf` and `docx` using `remark-pdf` and `remark-docx` | Moved | `add-client-side-transcript-export` 1.3 |
| 3.4 Add export error handling so failed client-side conversion surfaces a user-visible error without mutating transcript content | Moved | `add-client-side-transcript-export` 1.4 |
| 4.1 Add owner-scoped export actions to authenticated transcript-management surfaces for completed transcripts only | Moved | `add-client-side-transcript-export` 2.1 |
| 4.2 Ensure export actions consume canonical backend markdown rather than backend-generated files or HTML payloads | Moved | `add-client-side-transcript-export` 2.2 |
| 4.3 Add download naming based on the current display title and selected export format | Moved | `add-client-side-transcript-export` 2.3 |
| 5.1 Add automated coverage for share enable, disable, rotate, double-UUID link resolution, and private-library shared/unshared sort and filter behavior | Moved | `add-public-transcript-sharing` 3.1 |
| 5.2 Add automated coverage for privacy-minimal public rendering and generic unavailable behavior for invalid links | Moved | `add-public-transcript-sharing` 3.2 |
| 5.3 Add automated coverage for authenticated export authorization, completed-only export gating, and public-page absence of export controls | Split | Export authorization and completed-only gating move to `add-client-side-transcript-export` 3.1; public-page absence of export controls is preserved in both `add-public-transcript-sharing` 2.3 and `add-client-side-transcript-export` 3.1 |
| 5.4 Add automated coverage for client-side export assembly and conversion across `md`, `txt`, `pdf`, and `docx`, including the selected `remark`-based export pipeline | Moved | `add-client-side-transcript-export` 3.2 |

## Requirement Mapping

| Original requirement | Outcome | New home |
| --- | --- | --- |
| Owners can enable, disable, and rotate public sharing for completed transcripts | Moved | `add-public-transcript-sharing/specs/public-transcript-sharing/spec.md` |
| Public share URLs use a double-UUID design | Moved | `add-public-transcript-sharing/specs/public-transcript-sharing/spec.md` |
| Owners can organize their private library by public sharing state | Moved | `add-public-transcript-sharing/specs/public-transcript-sharing/spec.md` |
| Public share pages are read-only and privacy-minimal | Moved | `add-public-transcript-sharing/specs/public-transcript-sharing/spec.md` |
| Public share pages always reflect the current canonical transcript content | Moved | `add-public-transcript-sharing/specs/public-transcript-sharing/spec.md` |
| Invalid, disabled, rotated, and missing links share the same unavailable behavior | Moved | `add-public-transcript-sharing/specs/public-transcript-sharing/spec.md` |
| Owners can export completed transcripts in four formats | Moved | `add-client-side-transcript-export/specs/client-side-transcript-export/spec.md` |
| The backend remains markdown-first and the frontend performs format conversion locally | Moved | `add-client-side-transcript-export/specs/client-side-transcript-export/spec.md` |
| Exported documents are assembled from the latest canonical transcript content | Moved | `add-client-side-transcript-export/specs/client-side-transcript-export/spec.md` |
| Public share pages do not expose export actions | Moved | `add-client-side-transcript-export/specs/client-side-transcript-export/spec.md` and reinforced by `add-public-transcript-sharing/specs/public-transcript-sharing/spec.md` |
| Export failures are surfaced without mutating transcript content | Moved | `add-client-side-transcript-export/specs/client-side-transcript-export/spec.md` |

## Reconciliation Verdict

Every meaningful proposal item, design decision, task, and requirement from the preserved `add-transcript-sharing-and-exports` snapshot maps to exactly one of these outcomes:

- moves to `add-public-transcript-sharing`
- moves to `add-client-side-transcript-export`
- or is split deliberately across those two changes with an explicit rationale

No original product requirement was silently dropped in the split.
