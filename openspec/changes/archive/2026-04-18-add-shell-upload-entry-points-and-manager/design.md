## Overall initiative recap

This change is the third step of a four-part initiative that turns the authenticated web surface into a real workspace product. The full initiative introduces:

1. a canonical workspace overview page at `w/[slug]` plus deterministic default landing into it (done in `add-workspace-overview-and-default-landing`),
2. a shared private workspace shell for workspace-scoped routes — sidebar, thin header with a reserved search position, breadcrumb band, `CommandDialog` with an honest pre-launch empty state (done in `add-workspace-app-shell`),
3. workspace-scoped shell-level upload entry points (global drag-and-drop, header upload control) plus a persistent bottom-right upload manager that rehydrates from non-terminal transcripts (this change), and
4. moving authenticated `/account/security` and `/account/close` into the shared shell with default-workspace context resolution and a non-workspace breadcrumb root (the last change).

This change focuses exclusively on the upload experience inside the shell. Account-page relocation is deferred and is called out as an explicit non-goal below so the shell is never mistaken for a finished product surface at this point.

## Context

After `add-workspace-app-shell`, the shared shell is in place for workspace-scoped routes but it intentionally ships without any upload chrome. Meeting submission still starts from the dedicated `w/[slug]/meetings/new` surface, and the persistent transcript-processing lifecycle is still only visible on the dedicated status page. `submitMeeting()` already owns the client orchestration (prepare → upload → finalize → receive transcript id and initial status), and the dedicated status page already polls the workspace-scoped meeting-status endpoint using the authoritative transcript-processing vocabulary.

This change adds the workspace-scoped upload entry points and the persistent bottom-right upload manager on top of that shell. It does not rebuild the submission contract, it does not add a second transcript-processing model, and it does not invent a new polling transport. It reuses what is already there.

The product request was explicit about two things that shape the design:

- **drop-then-confirm**: a drop or a header upload activation must open a confirmation step (not immediately upload), so users can optionally add notes and accidental drops are cheap,
- **workspace-scoped state**: the tray must feel like it belongs to the workspace the user is in, must persist across same-workspace navigation, and must never leak across workspaces.

## Goals / Non-Goals

**Goals:**

- Add a global drag-and-drop target and an explicit header upload control inside the shared shell, both opening the same drop-then-confirm handoff associated with the current workspace.
- Add a persistent bottom-right upload manager that hosts the draft/confirmation state, the local submission phases after confirmation, and the transcript-processing lifecycle after queueing, using the existing lifecycle vocabulary.
- Support multiple concurrent items in the same workspace with a collapse-to-summary behavior and explicit dismissal rules that keep failed items pinned for the current workspace session.
- Rehydrate the upload-manager queue from the current workspace's non-terminal transcripts when the shell mounts, merging rehydrated items with client-side in-session items by transcript id.
- Keep upload-manager state workspace-keyed so one workspace's activity never leaks into another.
- Reuse `submitMeeting()` across the dedicated submission form, the shell drop handoff, and the shell header upload control as the single client orchestration path.
- Rewire the workspace overview's start-upload CTA so it opens the shell drop-then-confirm handoff instead of navigating to the dedicated submission page.
- Refuse shell-level submission in archived workspaces and for read-only members.

**Non-Goals:**

- Host `/account/security` or `/account/close` inside the shell. That is the next and final change. The upload manager is workspace-keyed, so it would have nowhere to attach on a non-workspace shell route anyway; once account pages join the shell with a default-workspace resolution, the same upload manager model applies naturally.
- Remove the dedicated submission page or the dedicated status page. Both remain reachable through direct links.
- Add a realtime transport (websocket or SSE) for transcript status. The existing polling contract used by the dedicated status page is reused.
- Add a second workspace-scoped meeting-status endpoint for the upload manager. The manager polls the same endpoint already used by the dedicated status page.
- Add cross-workspace global activity or multi-file batch submission.
- Implement workspace search (the reserved header slot and the `CommandDialog` empty state remain as they landed in `add-workspace-app-shell`).
- Introduce any new durable transcript semantics, retry rules, or processing-lifecycle stages.

## Decisions

### Decision: Treat the shell-level uploader as a workspace-scoped tray, not a toast

The shell will host one bottom-right floating upload manager that handles both:

- the draft/confirmation state immediately after a drop or a header upload activation,
- the active status queue after the user confirms.

The draft state is the drop-then-confirm handoff. It shows the dropped file, allows optional notes, and makes the user explicitly start submission. Once confirmed, the same tray item transitions into upload/progress behavior and then into transcript-processing status behavior.

The tray is a workspace-scoped queue and must handle multiple concurrent items cleanly:

- each submission or rehydrated transcript is its own tray item with its own state machine covering the local submission phases (`draft`, `preparing`, `uploading`, `finalizing`, `local error`) and the server transcript-processing phases (`queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, `failed`),
- the tray collapses into a compact header summary (count + current stage hint) when it grows beyond a small number of visible items,
- users can dismiss terminal items (completed and failed) from the tray; failed items stay pinned in the current workspace session until the user dismisses them,
- dismissal is client-only and never deletes the underlying transcript record; completed dismissed items remain reachable through the transcript library and detail routes.

This avoids a jarring split between "drop overlay", "confirmation modal", and "status toast". It also matches the product request more closely than using `sonner` or a transient notification pattern.

**Why this over alternatives**

- Over immediate upload on drop: it would remove the chance to add optional notes and would make accidental drops too expensive.
- Over a centered modal dialog for confirmation: it interrupts workspace continuity and creates a second major surface even though the user asked for a floating workspace-local affordance.
- Over a toast-only status UI: transcript processing is too long-lived and stateful for a disposable notification.
- Over auto-dismissing failed items after a timeout: failures often need the user to open the dedicated transcript status surface, and silent dismissal hides work from the person responsible for it.

### Decision: Reuse the existing submission contract and extend it with shell-local phases

The shell-level uploader will not create a second backend contract. It will reuse the existing browser/client orchestration already owned by `submitMeeting()`:

1. prepare submission,
2. upload media (and notes when present),
3. finalize submission,
4. receive transcript id and initial status.

The upload manager therefore needs a client-side item model with two layers of state:

- **local submission phases**: `draft`, `preparing`, `uploading`, `finalizing`, `local error`,
- **server transcript phases**: `queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, `failed`.

As soon as `submitMeeting()` returns a transcript id, the upload manager switches from local submission tracking to the existing workspace-scoped meeting-status polling contract.

**Why this over alternatives**

- Over adding a dedicated shell-upload API: it would duplicate the existing meeting submission path and risk drift between two ways of creating the same transcript resource.
- Over hiding local upload phases and only showing queued/processing states: users need feedback before the transcript id exists.

### Decision: Poll the existing status endpoint from the upload manager instead of adding realtime infrastructure

The dedicated meeting-status page already polls the workspace-scoped status endpoint and already uses the authoritative transcript-processing vocabulary. The upload manager will reuse that same endpoint and lifecycle rather than introducing websocket or SSE infrastructure in this change.

The upload manager item becomes linkable once the transcript id exists:

- while non-terminal, it links to the dedicated meeting-status page,
- after completion, it may link to transcript detail,
- after failure, it keeps the failure summary and still offers a route into the dedicated status page for inspection.

**Why this over alternatives**

- Over websocket/SSE now: the current product already has a polling-based status model, and a second transport would widen scope without changing the core transcript contract.
- Over keeping the tray unlinked: users need a path from the compact shell UI into the full dedicated surface.

### Decision: Keep upload-manager visibility scoped by workspace slug and rehydrate from the workspace on mount

The product request is explicitly workspace-scoped, so visible shell activity must be keyed by workspace slug. Items created in workspace `A` should remain visible as the user navigates within workspace `A`, but they must not leak into workspace `B`'s shell.

To keep this predictable, the upload-manager state will be stored in a workspace-keyed client store owned by the private workspace product layer. The current workspace shell reads only the items for its slug. This lets us preserve same-workspace continuity while keeping cross-workspace boundaries clean. The store is designed from day one as a map keyed by `workspaceSlug` so no later refactor is needed to enforce isolation.

On top of that client store, the shell will rehydrate the tray from the current workspace's non-terminal transcripts whenever it mounts for a workspace slug. This way, a user returning to the shell (via reload, navigation from another workspace, or cold start) still sees their in-flight work instead of an empty tray that contradicts the actual server state. The rehydration source is the existing workspace-scoped transcript reads — the upload manager queries the workspace transcript library for non-terminal states and then follows each rehydrated item through the existing polling contract. Client-side items added during the current session are merged into this rehydrated set by transcript id.

**Why this over alternatives**

- Over a single global tray that mixes all workspaces together: it weakens the workspace model and makes "drop into the current workspace" less trustworthy.
- Over tying state only to the currently rendered page component: the tray would reset too easily on route transitions and would be hard to keep coherent across the workspace shell.
- Over relying only on local memory without server rehydration: any reload, tab switch, or cross-workspace visit would make in-progress transcripts disappear from the tray even though they are still being processed server-side.
- Over adding a new shell-specific endpoint for "non-terminal transcripts": the existing workspace transcript library read contract already exposes workspace-scoped status information and avoids a parallel data path.

### Decision: Rewire the overview start-upload CTA to the shell drop-then-confirm handoff

`add-workspace-overview-and-default-landing` intentionally wired the overview's start-upload CTA to the dedicated submission page as a temporary handoff, because the shell drop-then-confirm flow did not exist yet. Now that this change introduces that flow, the overview CTA opens the same drop-then-confirm handoff used by the header upload control for the current workspace. The dedicated submission page remains reachable through direct links but is no longer the default entry point from the overview.

**Why this over alternatives**

- Over keeping the overview CTA pointed at the dedicated page: users would see two inconsistent upload surfaces — one from the overview, one from the header — for the same workspace action.
- Over removing the dedicated submission page: it still serves users who land there directly, and removing it would widen this change's scope beyond shell UX.

### Decision: Archived and read-only workspaces never show an active shell upload surface

The shell already conveys workspace context through the sidebar switcher and the breadcrumb. For archived workspaces, and for users with read-only access in the current workspace, shell-level submission MUST NOT be queueable:

- no accepting drop target (a drop over the shell does not open a handoff),
- no active header upload control (the control is absent or inactive),
- no shell-level submission path is available.

Existing archived-workspace and read-only behavior on the dedicated submission and status pages (rejections, informational notices) is unchanged.

**Why this over alternatives**

- Over showing an active drop target that rejects at confirmation: it misleads users into believing submission might work, then fails them late.
- Over showing the header upload control but disabling only the confirm step: it provides no value while adding noise; absence / inactivity is clearer.

## Risks / Trade-offs

- [Bottom-right tray UX can become noisy with repeated uploads] -> Design the tray as a compact queue with clear item states, collapse-to-summary behavior, and explicit dismissal rules for terminal items.
- [Rehydrating the tray from the workspace on mount can flood it with items a user does not expect] -> Limit rehydration to non-terminal transcripts the user can read and surface them with the same compact item model used for fresh submissions so the tray stays summarisable.
- [Workspace-scoped tray state is harder than a simple toast] -> Keep the state model explicit and keyed by `workspaceSlug` from day one instead of retrofitting scoping later.
- [Polling on many concurrent tray items could strain the workspace-scoped status endpoint] -> Reuse the existing endpoint and its polling cadence from the dedicated status page; do not invent per-item polling frequencies here.
- [Drop overlay could intercept drops intended for editor or library drop targets] -> Gate the shell drop target at the shell level; narrower drop targets inside the content area (if any exist in future) must explicitly stop propagation.
- [Same user dragging the same file twice could create duplicate tray items] -> The tray is client-side only; a second drop is a second draft item. Server-side deduplication is not in scope here and is handled by existing submission validation.

## Shadcn building blocks

This change adds the shell's upload chrome on top of the chrome installed in `add-workspace-app-shell`. By the time this change starts, the project has: `button`, `input`, `label`, `textarea`, `card`, `badge`, `empty`, `alert`, `skeleton`, `separator` (from the overview change), plus `sidebar`, `breadcrumb`, `collapsible`, `dropdown-menu`, `avatar`, `command`, `tooltip`, `kbd`, `sonner` (from the shell change). Use `.agents/skills/shadcn/SKILL.md` and `app/components.json` (`style: radix-mira`, `iconLibrary: remixicon`, `tailwind v4`).

| Use in the upload chrome | Component | Already installed? | CLI |
| --- | --- | --- | --- |
| Per-item draft / lifecycle row inside the bottom-right tray (file name, optional notes, current phase, dismiss). Use full `Card` composition: `CardHeader` for filename + lifecycle badge, `CardContent` for progress + notes, `CardFooter` for confirm/cancel/dismiss. | `card` | Yes (overview change) | — |
| Per-item phase chip — one chip per `draft` / `preparing` / `uploading` / `finalizing` / `local error` / `queued` / `preprocessing` / `transcribing` / `generating_recap` / `generating_title` / `finalizing` / `retrying` / `completed` / `failed`. Use `variant="secondary"` for in-progress, `variant="destructive"` for `local error` / `failed`, `variant="default"` for `completed`. Never raw colored spans. | `badge` | Yes (overview change) | — |
| Determinate progress for the local upload phases (`preparing` / `uploading` / `finalizing`) and for any server-side progress signal exposed by the meeting-status endpoint. | `progress` | No | `pnpm dlx shadcn@latest add progress` |
| Tray collapse-to-summary (header summary + count when the queue grows beyond a small visible number). Render the tray header as `CollapsibleTrigger` over a `SidebarMenuButton`-like row; render the queue list as `CollapsibleContent`. | `collapsible` | Yes (shell change, transitively via `sidebar-16`) | — |
| Scrollable queue inside the tray when many items are visible at once (constrain max-height; never an unconstrained scroll). | `scroll-area` | No | `pnpm dlx shadcn@latest add scroll-area` |
| Optional notes input inside the draft state. Use `Textarea` directly inside a `Field` + `FieldLabel` (per the forms rules — no raw `<div>` + `<label>` here). | `textarea` (and `field` for layout) | `textarea` yes; `field` likely no — verify | `pnpm dlx shadcn@latest add field` (only if not already pulled by something else) |
| Confirm / cancel / dismiss / "open in dedicated status page" buttons inside tray items. Use `variant="default"` for confirm, `variant="ghost"` for cancel and per-item dismiss, `variant="link"` (with `asChild` + `next/link`) for the route into the dedicated status / detail page. Never `isLoading` — compose with `Spinner` + `data-icon` + `disabled`. | `button` (+ `spinner`) | `button` yes; `spinner` likely no | `pnpm dlx shadcn@latest add spinner` |
| Tooltip on the disabled / absent header upload control in archived workspaces and for read-only members ("This workspace is archived" / "You don't have transcript-creation access here"). Tooltip on tray item icons (e.g. dismiss, open status) so the icon-only affordances stay legible. | `tooltip` | Yes (shell change) | — |
| Toast for completed submissions, dismissals that the user might want to undo, and shell-level submission errors that don't belong on a tray item (e.g. unsupported file type before a draft is even created). Use `toast()` from `sonner`; do NOT build custom toast divs. | `sonner` | Yes (shell change) | — |
| Modifier confirmation when the user dismisses a `failed` item that has not been opened in the dedicated status page (optional safety net). Use only if the team decides a confirmation is warranted; otherwise rely on the design's "failed items pin until dismissed" rule. | `alert-dialog` | No | `pnpm dlx shadcn@latest add alert-dialog` (optional) |
| Header upload control in the shell's thin header — uses the existing icon `Button variant="ghost"` pattern from the shell change, with a remix icon (`RiUploadCloud2Line`) and a `Tooltip`. Disable / hide it for archived workspaces and read-only members. | `button` (+ `tooltip`) | Yes | — |

Bulk install in one step:

```bash
pnpm dlx shadcn@latest add progress scroll-area field spinner alert-dialog
```

(Run `pnpm dlx shadcn@latest info --json` first; skip any package that is already in the `components` array.)

### Drag-and-drop overlay (no shadcn primitive)

There is no `dropzone` primitive in the `@shadcn` registry — this change should NOT install a third-party dropzone library either. Build the global drop overlay as a small client component mounted at the shell layout level:

- Listen for `dragenter` / `dragover` / `dragleave` / `drop` on `window` (gated by a "shell mounted with transcript-creation access in the current workspace" boolean from the workspace-keyed store).
- Render a fixed-position overlay covering the shell viewport using semantic tokens only: `bg-background/80 backdrop-blur-sm`, an inset dashed border using `border-2 border-dashed border-primary`, centered guidance text, and a remix icon (e.g. `RiUploadCloud2Line`).
- Identify the target workspace by name in the overlay (Decisions section: "current-workspace drop overlay that identifies the target workspace").
- On drop, hand the file off to the workspace-keyed store as a new `draft` tray item — never start the upload from the overlay itself.
- Reject cleanly: if the workspace is archived or the user is read-only, never accept the drop and never show the overlay (Decisions section "Archived and read-only workspaces never show an active shell upload surface").

### Tray geometry (composed, not a separate primitive)

The upload manager is a single shell-level component composed from the primitives above:

- Container: a `<div>` fixed at `bottom-4 right-4` (responsive on mobile), constrained width (e.g. `w-96 max-w-[calc(100vw-2rem)]`), with `Card` chrome.
- Header row (always visible): collapse `CollapsibleTrigger` with a remix chevron icon (`RiArrowDownSLine` / `RiArrowUpSLine`), a one-line summary (count + current dominant stage), and a "dismiss all completed" `Button variant="ghost" size="icon"` when the queue has dismissable items.
- Queue: `CollapsibleContent` containing a `ScrollArea` that lists per-item `Card`s.
- Per-item card: filename truncation (use `truncate` shorthand, never the long `overflow-hidden text-ellipsis whitespace-nowrap` trio), lifecycle `Badge`, `Progress` (when applicable), optional notes `Textarea` while in `draft`, action buttons in `CardFooter`.

### Composition notes for the implementer

- **Workspace identity in the overlay and the tray.** Always show the workspace name (read from the explicit `[slug]` provider on workspace routes; from the resolved default-workspace context on the account routes that join the shell in `add-account-pages-inside-shell`). This is what makes the drop feel scoped.
- **Form layout for the draft state.** Use `FieldGroup` + `Field` + `FieldLabel` even for the optional notes — `.agents/skills/shadcn/SKILL.md` rules forbid raw `<div>` + `<label>` for form layout.
- **No `isPending` / `isLoading` on `Button`.** Compose `Spinner` + `data-icon="inline-start"` + `disabled` on the confirm button while a draft transitions to `preparing`.
- **Icons.** Remix icons only: `RiUploadCloud2Line` (upload + overlay), `RiCloseLine` (cancel / dismiss), `RiCheckLine` (confirm), `RiErrorWarningLine` (failed badge), `RiLoader4Line` or `Spinner` for in-progress. Use `data-icon` inside `Button`, no `size-4`.
- **Dismissal is client-only.** Mirror the design: never call any server endpoint from the tray's dismiss action; only mutate the workspace-keyed store.
- **Forbidden patterns.** No custom drop-zone library, no centered modal for the confirmation step (the tray draft IS the confirmation surface), no per-item polling cadence different from the dedicated status page (reuse the existing polling), no manual `z-index` on the tray that competes with `Dialog` / `Sheet` / `DropdownMenu` from the rest of the shell.

## Migration Plan

1. Introduce a workspace-keyed client upload-manager store/provider owned by the private workspace product layer. Keys are `workspaceSlug`; values are lists of tray items that carry both the local submission phase and the server transcript-processing phase.
2. Add a shell-level global drop overlay that identifies the current workspace as the target and an explicit header upload control in the shell's thin header. Both open the same drop-then-confirm handoff associated with the current workspace.
3. Implement the drop-then-confirm handoff as a tray draft state that allows the user to review the file and optionally add notes; no upload begins until the user confirms.
4. Implement the bottom-right upload manager tray: multi-item queue, local submission phases after confirmation, transition to transcript-processing phases after `submitMeeting()` returns a transcript id, collapse-to-summary when the queue is large, dismissal rules (failed items persist until dismissed).
5. Reuse the existing workspace-scoped meeting-status endpoint from the upload manager to follow accepted shell submissions after transcript ids are created. Do not introduce a new endpoint or a realtime transport.
6. Rehydrate the tray on shell mount by reading the current workspace's non-terminal transcripts via the existing workspace transcript library read and merging them with any client-side in-session items by transcript id.
7. Refuse shell-level submission for archived workspaces and read-only members: no accepting drop target, no active header upload control.
8. Share `submitMeeting()` across the dedicated submission form, the shell drop handoff, and the shell header upload control as a single orchestration path.
9. Rewire the workspace overview start-upload CTA to open the shell drop-then-confirm handoff.
10. Add regression coverage for drop handoff from both entry points, same-workspace tray persistence across navigation, cross-workspace tray isolation, rehydration on shell mount, archived / read-only workspace rules, and the overview CTA rewiring.

Rollback strategy:

- keep the dedicated submission and dedicated status pages fully usable so they can remain the only path if the shell-level uploader must be disabled.
- the shell chrome (sidebar, header, breadcrumb band, `CommandDialog`) is unaffected by withdrawing the upload manager; the drop overlay, the header upload control, and the tray can be temporarily disabled as a unit.
- if the rehydration path causes issues, it can be disabled independently from drop-then-confirm and in-session tray behavior.

## Open Questions

None open. The account-pages question is deferred to the final change in this initiative. The upload manager's workspace-keyed model naturally accommodates account pages once they join the shell with a resolved default workspace.
