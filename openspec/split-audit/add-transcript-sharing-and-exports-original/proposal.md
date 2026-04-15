## Why

The transcript record is now defined as the durable product resource and users can manage their own records, but the product still lacks the two outward-facing outcomes promised by the brief: safe public sharing and downloadable exports. This change is needed now because sharing and export both depend on the canonical markdown contract already established by processing and management, and they complete the requested user-facing workflow without changing the privacy posture of the system.

## What Changes

- Add owner-controlled public transcript sharing with enable, disable, and secret rotation actions.
- Define a double-UUID public URL design for read-only sharing that is difficult to guess and does not expose internal transcript identifiers.
- Add privacy-minimal public transcript rendering that exposes only the fields required for a useful shared transcript view.
- Extend the authenticated transcript library so owners can see and organize transcripts by public sharing state.
- Define access behavior for disabled, rotated, missing, or otherwise invalid public links.
- Add authenticated export actions for owned transcripts in `md`, `txt`, `pdf`, and `docx`.
- Preserve the markdown-first contract by requiring the backend to send canonical markdown to the frontend and requiring the frontend to perform the export conversion locally.

## Capabilities

### New Capabilities
- `public-transcript-sharing`: Owner-managed public sharing, double-UUID share URLs, read-only public rendering, privacy-minimal public payloads, and invalid-link behavior for disabled or rotated shares.
- `client-side-transcript-export`: Authenticated transcript export actions that convert canonical backend markdown on the frontend into `md`, `txt`, `pdf`, and `docx`.

### Modified Capabilities
- None.

## Impact

- The Next.js web runtime must add owner-scoped share management actions, share-state projections for private library organization, and a public read-only share surface that does not rely on authenticated transcript access rules.
- Transcript persistence must support share state, stable public share identifiers, rotatable share secrets, and privacy-minimal public projections.
- `app/` must add share controls to transcript management surfaces, share-state organization controls in the private library, a public read-only transcript page, and client-side export flows for the four required formats.
- The frontend export path must introduce local markdown conversion logic while preserving the rule that the backend only sends markdown to the frontend.
