## Why

The transcript record is now defined as a workspace-scoped durable product resource and collaboration happens through workspace roles, but the product still lacks a safe public way to share completed transcripts. This change is needed now because public sharing depends on the canonical markdown contract already established by processing and management, and it completes the externally visible read-only sharing workflow without weakening the workspace privacy posture.

## What Changes

- Add workspace role-based public transcript sharing with enable, disable, and secret rotation actions for `member` and `admin` users in active workspaces.
- Define a double-UUID public URL design for read-only sharing that is difficult to guess and does not expose internal transcript identifiers.
- Add privacy-minimal public transcript rendering that exposes only the fields required for a useful shared transcript view.
- Extend the authenticated transcript library so workspace users can see and organize transcripts by public sharing state.
- Define access behavior for disabled, rotated, missing, or otherwise unavailable public links in active workspaces, while relying on `add-workspace-archival-lifecycle` for archive-driven availability.
- Ensure the public share page never exposes private workspace metadata, management controls, or export actions.

## Capabilities

### New Capabilities
- `public-transcript-sharing`: Active-workspace public sharing, double-UUID share URLs, read-only public rendering, privacy-minimal public payloads, workspace-visible share-state organization, invalid-link behavior for disabled, rotated, missing, or otherwise invalid public access, and integration with `add-workspace-archival-lifecycle` for archive-driven availability.

### Modified Capabilities
- None.

## Impact

- The Next.js web runtime must add workspace-scoped share management actions for `member` and `admin` users in active workspaces, share-state projections for workspace library organization, and lifecycle-aware public share resolution aligned with `add-workspace-archival-lifecycle` rather than authenticated transcript access rules.
- Transcript persistence must support share state, stable public share identifiers, rotatable share secrets, and privacy-minimal public projections for workspace transcript records.
- `app/` must add share controls to transcript-management surfaces for `member` and `admin`, share-state organization controls in the private workspace library, and a public read-only transcript page that stays separate from authenticated workspace actions.
