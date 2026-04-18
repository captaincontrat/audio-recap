## Why

`add-workspace-app-shell` introduced the shared workspace shell with sidebar, thin header, breadcrumb band, and the reserved header search slot, but it deliberately shipped the shell without any upload chrome. Meeting submission is still tied to the dedicated `w/[slug]/meetings/new` surface, and the persistent transcript-processing lifecycle is only visible on the dedicated status page. That keeps the shell from carrying its full product intent: the user asked for a workspace where upload is a first-class action that can begin from anywhere they are already working, and where in-flight processing is visible without navigating to a dedicated surface.

This change adds the workspace-scoped upload entry points and the persistent bottom-right upload manager to the existing shell. It introduces a drop-then-confirm handoff, a workspace-keyed client store, and rehydration from the current workspace's non-terminal transcripts, all on top of the shell introduced in the previous change. No new backend submission or status contract is added — this change reuses the existing `submitMeeting()` orchestration and the existing workspace-scoped status polling endpoint.

## What Changes

- Add a workspace-scoped global drag-and-drop target that works anywhere inside the shared shell and a matching explicit header upload control. Both entry points MUST open the same drop-then-confirm handoff associated with the current workspace.
- Add a drop-then-confirm handoff that lets the user review the file and optionally add notes before any upload begins, and that does NOT upload or queue transcript work until the user explicitly confirms.
- Add a persistent bottom-right upload manager that starts with local upload phases after confirmation and then continues into the existing transcript-processing lifecycle once the transcript id exists, using the same lifecycle vocabulary (`queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, `failed`).
- Support multiple concurrent items in the same workspace, with a collapse-to-summary behavior when the queue grows beyond a small number of visible items, and explicit dismissal rules that keep failed items pinned for the current workspace session until the user dismisses them.
- Rehydrate the upload manager from the current workspace's non-terminal transcripts when the shell mounts, so in-progress work survives reloads and navigation back into the workspace. Merge rehydrated items with client-side in-session items by transcript id.
- Scope upload-manager state by workspace slug in a workspace-keyed client store so one workspace's in-flight submissions are never shown while the user is viewing another workspace, while same-workspace navigation keeps the tray visible and consistent.
- Refuse the shell-level upload path for archived workspaces and for users without transcript-creation access in the current workspace: no accepting drop target, no active header upload control, no queueable submissions from the shell.
- Reuse the existing `submitMeeting()` client orchestration across the dedicated submission form, the shell drag-and-drop handoff, and the shell header upload control so there is only one workspace-scoped submission path.
- Rewire the workspace overview's start-upload CTA so it opens the same drop-then-confirm handoff used by the shell's header upload control, instead of navigating to the dedicated submission page.

## Explicit deferrals

This change is deliberately narrow. The following shell-adjacent behaviors do NOT ship here and are the responsibility of a later change:

- **Authenticated `/account/security` and `/account/close` rendering inside the shared shell** — this lands in `add-account-pages-inside-shell`. Those routes continue to render with their current bare layouts while this change ships. Because the upload manager is always workspace-keyed, it will never be shown on `/account/*` routes in this change. Once the account-pages change lands, the same workspace-keyed model will naturally apply to a default-workspace-resolved shell on those routes.
- **Workspace search** remains a reserved position and a pre-launch command surface; this change does not implement search.

## Capabilities

### New Capabilities

- None in this change. The upload entry points and the upload manager extend the existing `workspace-app-shell` capability introduced in the previous change.

### Modified Capabilities

- `workspace-app-shell`: Extended to expose workspace-scoped upload entry points (global drag-and-drop target inside the shell plus an explicit header upload control) that open a drop-then-confirm handoff, and to host a persistent workspace-scoped bottom-right upload manager that carries submissions from local upload phases into the existing transcript-processing lifecycle, supports multiple concurrent items, rehydrates from the current workspace's non-terminal transcripts when the shell mounts, and stays visible during same-workspace navigation without leaking cross-workspace activity.
- `meeting-import-processing`: Workspace-scoped meeting submission expands from a dedicated-page-only initiation model to also include shell-level upload entry points (drag-and-drop plus header upload control), the drop-then-confirm handoff, and the persistent workspace-scoped upload manager as a second workspace-scoped post-submit status surface alongside the dedicated status page.
- `workspace-overview`: Two requirements are MODIFIED. The overview's "summarizes current workspace activity" requirement is updated so the start-upload affordance is described as navigation to the shell-level upload entry points (rather than a generic CTA), matching the shell upload chrome introduced here. The overview's "product landing surface" requirement is updated so the start-upload call-to-action opens the shared shell's drop-then-confirm handoff for the current workspace instead of navigating to the dedicated submission page.

## Impact

- `app/` gains a workspace-keyed client upload-manager store/provider, a global drop overlay mounted at the shell level, a header upload control in the shell's thin header, a bottom-right tray component with a draft/confirm state and a multi-item queue, and shell rehydration that reads the current workspace's non-terminal transcripts via the existing workspace transcript library read.
- The client-side meeting submission orchestration continues to live in `submitMeeting()` and is now shared across the dedicated submission form, the shell drop handoff, and the shell header upload control. No new server endpoint is introduced for shell-level submission.
- The upload manager item model carries two layers of state: local submission phases (`draft`, `preparing`, `uploading`, `finalizing`, `local error`) and the server transcript-processing phases reused from the existing lifecycle. The manager transitions from the first layer to the second as soon as `submitMeeting()` returns a transcript id.
- The upload manager polls the existing workspace-scoped meeting-status endpoint already used by the dedicated status page. No websocket or SSE transport is introduced in this change.
- Upload-manager state is keyed by `workspaceSlug` from the start. Same-workspace navigation preserves items; cross-workspace navigation hides items from other workspaces and only shows the new workspace's items. Items created in workspace `A` MUST NOT appear in workspace `B`'s shell, even if both are mounted in the same browser session.
- Rehydration reads the current workspace's non-terminal transcripts through the existing workspace transcript library read on shell mount, merges those items with any client-side in-session items by transcript id, and then follows each rehydrated item through the existing polling contract.
- Archived workspaces and read-only members see the shell chrome without an accepting drop target and without an active header upload control; shell-level submission is never queueable for them. Existing archived-workspace and read-only behavior on the dedicated submission and status pages is unchanged.
- Workspace overview's start-upload CTA is rewired to open the shell drop-then-confirm handoff. The dedicated submission page remains reachable through direct links and is not removed.
