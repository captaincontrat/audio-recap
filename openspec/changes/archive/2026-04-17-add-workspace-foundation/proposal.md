## Why

The current web product plan still assumes that transcripts and later transcript-adjacent features are owned directly by one user. Team collaboration needs a workspace boundary before processing, management, sharing, and export harden around `ownerUserId`, or the project will pay for a broad schema and authorization refactor later.

## What Changes

- Add a workspace model with `personal` and `team` workspaces.
- Auto-create one personal workspace for each new account.
- Add membership roles `read_only`, `member`, and `admin` plus the invariant that an active workspace must always retain at least one admin.
- Define workspace as the durable ownership boundary for transcript-adjacent product data while keeping user accounts as the live identity and authentication entity and creator attribution separate from workspace ownership.
- Establish the minimum workspace context contract that later authenticated product surfaces can rely on: workspace-scoped private surfaces are URL-addressed, while authenticated entry without an explicit workspace uses explicit destination first, then last valid workspace, then personal workspace.

## Capabilities

### New Capabilities
- `workspace-foundation`: Workspace types, auto-created personal workspaces, membership roles, base admin invariants, and workspace-scoped ownership rules for later product features.

### Modified Capabilities
- None.

## Impact

- Postgres schema will need durable workspace and membership state.
- Account creation and authenticated session bootstrap will need to create a personal workspace and resolve deterministic default landing for authenticated entry.
- Later transcript processing, management, sharing, and export changes will need to move from owner-scoped assumptions to workspace-scoped ones.
- Authenticated route handling will need a shared workspace context contract with explicit workspace-scoped routes even before every workspace-selection UX detail is finalized.
