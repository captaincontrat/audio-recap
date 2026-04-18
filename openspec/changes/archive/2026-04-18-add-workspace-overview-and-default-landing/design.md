## Overall initiative recap

This change is the first step of a four-part initiative that turns the authenticated web surface into a real workspace product. The full initiative introduces:

1. a canonical workspace overview page at `w/[slug]` plus deterministic default landing into it (this change),
2. a shared private workspace shell (sidebar, thin header with a reserved search position, breadcrumb band, `CommandDialog` with an honest pre-launch empty state) for workspace-scoped routes,
3. workspace-scoped shell-level upload entry points (global drag-and-drop, header upload control) plus a persistent bottom-right upload manager that rehydrates from non-terminal transcripts, and
4. moving authenticated `/account/security` and `/account/close` into the shared shell.

This change does not introduce the shell, the upload entry points, or the account-page relocation. It is deliberately the smallest independently valuable step: ship a real workspace overview, convert `/dashboard` into a redirect, and unblock the shell work that follows by giving it a concrete workspace home to land on.

## Context

The current web product already has the core private capabilities needed to become a real workspace application:

- `workspace-foundation` defines the explicit current-workspace contract plus deterministic default landing.
- `meeting-import-processing` defines the dedicated meeting submission flow and the transcript post-submit status lifecycle.
- `private-transcript-library` defines workspace-scoped transcript browsing and transcript detail reading.

What is missing at the landing layer is a canonical workspace home. `/dashboard` is a centered placeholder that reports the signed-in user's email and passkeys, `w/[slug]` has no root page (only `w/[slug]/transcripts` and `w/[slug]/meetings/*` exist), and authenticated entry without an explicit destination drops the user onto that placeholder rather than into a workspace-scoped surface. Because every durable product resource is workspace-owned, the landing layer should also be workspace-scoped.

This change turns the existing capabilities into a real workspace landing surface without redefining any of the underlying read contracts. It establishes `w/[slug]` as the canonical workspace home, reduces `/dashboard` to an authenticated redirect entry point, and leaves the shared shell, shell-level upload, and account-page relocation for follow-up changes.

## Goals / Non-Goals

**Goals:**

- Make `w/[slug]` the canonical workspace home route for an accessible active workspace and reduce `/dashboard` to a redirect-only authenticated entry.
- Organize the overview around two workspace-scoped activity groups grounded in existing transcript data: an active-work group (non-terminal plus terminal failed transcripts) and a library-highlights group (recently updated transcripts).
- Reuse the existing workspace transcript reads; do not invent a new aggregate endpoint for the overview in this change.
- Make authenticated entry without an explicit destination resolve into the resolved workspace's overview route.
- Keep transcript-processing stages, retry rules, and durable transcript semantics unchanged.

**Non-Goals:**

- Introduce the shared private workspace shell (sidebar, thin header, breadcrumb band, `CommandDialog`). That is the next change.
- Introduce shell-level upload entry points (drag-and-drop overlay, header upload control) or a persistent upload manager. A later change covers these.
- Move authenticated `/account/security` or `/account/close` into a shell. A later change covers these.
- Replace the dedicated meeting-submission page or the dedicated transcript-status page.
- Add cross-workspace global activity, multi-file batch submission, websocket/SSE realtime transport, or analytics-style dashboard charts beyond the two activity groups.
- Change `workspace-foundation`'s rule that explicit workspace route context is authoritative; this change only refines the default-landing behavior when no explicit destination is provided.

## Decisions

### Decision: Make `w/[slug]` the canonical workspace home and reduce `/dashboard` to a redirect-only authenticated entry

The private product should be workspace-first, not dashboard-first. The route that already carries explicit workspace authority is `w/[slug]`, so this change makes `w/[slug]` the canonical workspace home and treats `/dashboard` as an authenticated entry point that resolves the default workspace and redirects into that workspace's overview route.

This aligns the URL model with the existing `workspace-foundation` rule that explicit workspace context is authoritative and lets later work (shared shell, shell-level upload) attach to one concrete workspace route tree.

**Why this over alternatives**

- Over keeping `/dashboard` as a real standalone product page: it would preserve an artificial non-workspace layer even though transcripts, submission, and collaboration are already workspace-scoped.
- Over redirecting directly into `/w/[slug]/transcripts`: the product benefits from a lightweight workspace overview that summarizes active processing and recent work; jumping straight to the library skips that.

### Decision: Overview composes two workspace-scoped activity groups grounded in existing reads

The overview surfaces two workspace-scoped activity groups:

- an **active-work group** that unions transcripts whose processing has not yet reached a terminal successful state (`queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`) with transcripts in terminal `failed` states, with failed items surfaced as attention-worthy,
- a **library-highlights group** that lists recently updated transcripts the user can read.

Both groups are computed from the existing workspace transcript reads used by `private-transcript-library` rather than from a new aggregate endpoint. The overview page runs two server-side queries against the same underlying read and composes their results. This keeps the overview cheap to ship and cheap to change later.

**Why this over alternatives**

- Over a full analytics dashboard (charts, metrics, KPIs): the product data model does not yet justify one, and an invented dashboard would risk drifting from real workspace state.
- Over a single feed that interleaves active and recent work: separating active work from library highlights lets failed items stand out and lets the library-highlights group read as a discovery surface rather than a status surface.
- Over a new overview-specific backend endpoint: composing existing workspace transcript reads keeps the backend surface unchanged and keeps the overview aligned with library behavior by construction.

### Decision: Start-upload CTA routes to the existing dedicated submission page in this change

The overview exposes a start-upload action for users who have transcript-creation access in the current workspace. In this change, that action navigates to the existing dedicated submission surface at `w/[slug]/meetings/new`. The later shell-level upload change will rewire this CTA to open a shell-level drop-then-confirm handoff without changing the overview's role as the starting point.

Encoding the CTA behavior this way keeps the overview useful immediately without pulling the shell-level upload work into this change.

**Why this over alternatives**

- Over hiding the start-upload CTA until the shell-level flow exists: the overview would feel passive for a workspace that has no in-progress or recent work.
- Over introducing a temporary inline upload control on the overview page: it would be thrown away once the shell-level drop-then-confirm handoff lands, and users would see two different upload surfaces in quick succession.

### Decision: `w/[slug]` inherits the private-workspace access model instead of inventing a new one

The overview reuses the access rules that `private-transcript-library` already applies to workspace-scoped routes:

- a user without access to `w/[slug]` gets the same not-found behavior used for other private workspace-scoped routes,
- a user visiting an archived workspace sees the same archived-workspace behavior used elsewhere,
- a user with read-only access sees the activity groups and library links but not a create-work CTA.

This avoids introducing a new "visible but empty" state or a new access path, and keeps the overview consistent with the rest of the workspace product.

**Why this over alternatives**

- Over exposing a different access model at `w/[slug]`: it would create an inconsistent read contract where one workspace route hides existence and another reveals it.
- Over always showing the create-work CTA regardless of role: the CTA would be misleading for `read_only` members.

## Risks / Trade-offs

- [Overview scope can bloat into a full analytics dashboard] -> Limit the overview to two workspace-scoped activity groups grounded in existing transcript data.
- [Composing two list reads on the server can be slower than a purpose-built aggregate] -> Accept the simplicity of reusing the existing workspace transcript read surface in this change and revisit only if overview latency becomes a measured product issue.
- [A temporary CTA handoff to the dedicated submission page creates a brief UX inconsistency with the later shell-level upload] -> Call out the deferral explicitly in the overview spec so reviewers and follow-up work know the CTA is expected to evolve.
- [`/dashboard` users may have bookmarks or in-app references to the old page content] -> Convert `/dashboard` into a redirect that preserves authentication semantics, so bookmarks continue to work and simply resolve into the user's default workspace overview.

## Shadcn building blocks

The overview page is built almost entirely by composing existing shadcn primitives — see `.agents/skills/shadcn/SKILL.md` for the rules and `app/components.json` for the project config (`style: radix-mira`, `iconLibrary: remixicon`, `tailwind v4`, base alias `@/components/ui`). Already installed at the start of this change: `button`, `input`, `label`, `textarea`. The implementer SHOULD NOT hand-roll anything the table below already covers.

| Use in the overview | Component | Already installed? | CLI |
| --- | --- | --- | --- |
| Active-work group container, library-highlights group container, archived-workspace notice block | `card` (with `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` — full composition, never just `CardContent`) | No | `pnpm dlx shadcn@latest add card` |
| Per-row processing-stage chip (`queued`, `transcribing`, `failed`, …) and the "attention-worthy" mark on terminal-failed items inside the active-work group | `badge` (use variants `secondary` for in-progress stages and `destructive` for failed; never raw colored spans) | No | `pnpm dlx shadcn@latest add badge` |
| Workspace overview empty state (current user has no visible transcripts in this workspace) | `empty` (`Empty` + `EmptyHeader` + `EmptyTitle` + `EmptyDescription` + `EmptyContent`; never a custom centered div) | No | `pnpm dlx shadcn@latest add empty` |
| Archived-workspace inactive notice on the overview, replacing the ad-hoc `ArchivedWorkspaceNotice` div used today on `w/[slug]/transcripts/page.tsx` | `alert` (`Alert` + `AlertTitle` + `AlertDescription`) | No | `pnpm dlx shadcn@latest add alert` |
| Server-streamed loading placeholders for the two activity groups while transcripts resolve (no manual `animate-pulse` divs) | `skeleton` | No | `pnpm dlx shadcn@latest add skeleton` |
| Visual divider between the active-work group and the library-highlights group (use only if the cards do not already provide enough separation; never `<hr>` or a `border-t` div) | `separator` | No | `pnpm dlx shadcn@latest add separator` |
| Start-upload CTA, "Browse all transcripts" link, "Submit a meeting" CTA. Visible only to users with transcript-creation access. | `button` (use `variant="default"` for the primary CTA and `variant="ghost"` or `variant="link"` for the secondary navigation link; use `asChild` + `next/link` for navigation, not a hand-rolled anchor) | Yes | — |

Bulk install in one step:

```bash
pnpm dlx shadcn@latest add card badge empty alert skeleton separator
```

Composition notes for the implementer:

- **Icons.** This project's `iconLibrary` is `remixicon`. Use `@remixicon/react` (e.g. `RiUploadCloud2Line` for the start-upload CTA, `RiAlertLine` for failed-item chips, `RiInboxLine` or `RiFolderOpenLine` for the empty state). Do NOT introduce `lucide-react` here. When placing an icon inside a `Button`, use `data-icon="inline-start"` and let the component handle sizing — do not add `size-4`.
- **Failed-item attention mark.** `Badge variant="destructive"` plus a remix icon (e.g. `RiAlertFill`) inside the active-work card row, not a custom red span.
- **Read-only members.** Conditionally render the start-upload `Button` only when the resolved access role allows transcript creation; do not render a disabled CTA.
- **Layout container.** Keep the page's outer `main` close to the existing `mx-auto max-w-3xl` width used by `w/[slug]/transcripts/page.tsx` so typography and spacing stay consistent until the shared shell lands in `add-workspace-app-shell`.

## Migration Plan

1. Add the workspace overview route at `w/[slug]/page.tsx` that renders the active-work and library-highlights groups plus the start-upload CTA (when the user has transcript-creation access) and an empty state.
2. Apply the existing private-workspace access behavior to the overview (inaccessible → not-found, archived → archived-workspace behavior, read-only → overview without create CTA).
3. Convert `/dashboard/page.tsx` into an authenticated redirect that resolves the default workspace and redirects to that workspace's overview route.
4. Update internal links currently pointing at `/dashboard` as a product destination so they target the resolved workspace overview where appropriate.
5. Add regression coverage for authenticated default landing (dashboard redirect, explicit destination preserved, archived-workspace fallback), overview access model, and overview group contents.

Rollback strategy:

- preserve the dedicated submission and dedicated status pages; they remain valid workspace-scoped surfaces regardless of overview state.
- if the overview must be temporarily withdrawn, convert `/dashboard` back into a page-level surface that resolves a default workspace and links into the transcript library, without undoing the route structure at `w/[slug]`.

## Open Questions

None open. The overview's content shape is intentionally narrow in this change; later follow-up work can expand the groups (for example adding tag- or important-based sections) on top of the stable two-group contract established here.
