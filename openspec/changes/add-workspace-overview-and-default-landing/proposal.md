## Why

The product has the `workspace-foundation`, `meeting-import-processing`, and `private-transcript-library` capabilities in place, but the authenticated landing experience is still a placeholder `/dashboard` page that is not workspace-scoped, and `w/[slug]` has no root page even though `w/[slug]/transcripts` already exists. That mismatch makes the private product feel dashboard-first rather than workspace-first and leaves later workspace-scoped work (shared shell, shell-level upload) without a canonical workspace home to land on or attach to.

This change is the first of four that split the previously combined `add-workspace-shell-and-global-upload` proposal into smaller, independently shippable steps. It focuses exclusively on the canonical workspace home page and deterministic default landing, so that later work can build on a concrete `w/[slug]` route tree and on an authenticated entry model where `/dashboard` resolves into a real workspace overview instead of a standalone page.

## What Changes

- Add a real workspace overview page at `w/[slug]` as the primary authenticated landing surface for a resolved current workspace.
- Organize the overview around two workspace-scoped activity groups: an active-work group that combines non-terminal transcripts with terminal failed transcripts, and a library-highlights group that surfaces recently updated transcripts.
- Convert `/dashboard` from a standalone account-summary page into an authenticated redirect that resolves the default workspace and lands on that workspace's overview route.
- Make authenticated entry points that do not carry an explicit destination resolve into the current workspace overview route instead of a generic non-workspace dashboard page.
- Keep the existing dedicated meeting-submission surface (`w/[slug]/meetings/new`) as the upload entry point from the overview's start-upload CTA for now; a later change introduces shell-level upload entry points and replaces that CTA handoff.
- Preserve the existing page-layout conventions for workspace routes in this change: the overview renders with the same page shell as `w/[slug]/transcripts` today. The shared private workspace shell (sidebar, header, breadcrumb band) is introduced in a follow-up change.

## Capabilities

### New Capabilities

- `workspace-overview`: Workspace-scoped overview page that acts as the primary landing surface for the current workspace and surfaces an active-work group (non-terminal plus failed transcripts) and a library-highlights group (recently updated transcripts).

### Modified Capabilities

- `workspace-foundation`: Authenticated entry without an explicit workspace destination now lands on the resolved workspace overview route rather than on a generic dashboard placeholder.

## Impact

- `app/` gains a new `w/[slug]/page.tsx` route and converts `/dashboard` into an authenticated redirect into the resolved workspace overview.
- The overview route reuses the existing workspace-scoped transcript reads (`readTranscriptLibrary` or equivalent) to power its two activity groups — no new durable read contract is introduced.
- The overview does not introduce any new workspace-scoped server endpoints beyond what the transcript library already provides; it composes existing reads into two summary projections.
- The overview's start-upload CTA, for users with transcript-creation access, routes to the existing dedicated submission surface; the later shell-level upload change rewires this CTA to open a shell drop-then-confirm handoff.
- No shared private shell, no drag-and-drop overlay, no header upload control, and no persistent upload manager are introduced in this change.
- No new capability is added for workspace search, and no visual changes to authentication or public share routes are made.
