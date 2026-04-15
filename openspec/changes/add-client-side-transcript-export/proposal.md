## Why

The transcript record is now defined as the durable product resource and users can manage their own records, but the product still lacks downloadable exports for owned transcripts. This change is needed now because export depends on the canonical markdown contract already established by processing and management, and splitting it away from public sharing keeps the browser-side conversion scope focused without weakening the privacy boundary.

## What Changes

- Add authenticated export actions for owned transcripts in `md`, `txt`, `pdf`, and `docx`.
- Preserve the markdown-first contract by requiring the backend to send canonical markdown to the frontend and requiring the frontend to perform the export conversion locally.
- Assemble each export from the latest canonical display title, recap markdown, and transcript markdown.
- Add title-derived filenames and user-visible client-side export failure handling.
- Ensure public share pages remain read-only and do not expose export actions.

## Capabilities

### New Capabilities
- `client-side-transcript-export`: Authenticated transcript export actions that convert canonical backend markdown on the frontend into `md`, `txt`, `pdf`, and `docx`.

### Modified Capabilities
- None.

## Impact

- The Next.js web runtime must add owner-scoped export actions for completed transcripts on authenticated transcript-management surfaces.
- `app/` must add export entry points and local markdown conversion flows while preserving the rule that public share pages stay read-only.
- The frontend export path must introduce a browser-side markdown conversion pipeline while preserving the rule that the backend only sends canonical markdown to the frontend.
