## Why

The transcript record is now defined as the durable product resource and users can manage their own records, but the product still lacks a safe public way to share completed transcripts. This change is needed now because public sharing depends on the canonical markdown contract already established by processing and management, and it completes the externally visible read-only sharing workflow without changing the system's privacy posture.

## What Changes

- Add owner-controlled public transcript sharing with enable, disable, and secret rotation actions.
- Define a double-UUID public URL design for read-only sharing that is difficult to guess and does not expose internal transcript identifiers.
- Add privacy-minimal public transcript rendering that exposes only the fields required for a useful shared transcript view.
- Extend the authenticated transcript library so owners can see and organize transcripts by public sharing state.
- Define access behavior for disabled, rotated, missing, or otherwise invalid public links.
- Ensure the public share page never exposes owner-only metadata, management controls, or export actions.

## Capabilities

### New Capabilities
- `public-transcript-sharing`: Owner-managed public sharing, double-UUID share URLs, read-only public rendering, privacy-minimal public payloads, owner-visible share-state organization, and invalid-link behavior for disabled or rotated shares.

### Modified Capabilities
- None.

## Impact

- The Next.js web runtime must add owner-scoped share management actions, share-state projections for private library organization, and a public read-only share surface that does not rely on authenticated transcript access rules.
- Transcript persistence must support share state, stable public share identifiers, rotatable share secrets, and privacy-minimal public projections.
- `app/` must add share controls to transcript-management surfaces, share-state organization controls in the private library, and a public read-only transcript page that stays separate from authenticated owner actions.
