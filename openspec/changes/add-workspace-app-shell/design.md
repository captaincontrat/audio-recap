## Overall initiative recap

This change is the second step of a four-part initiative that turns the authenticated web surface into a real workspace product. The full initiative introduces:

1. a canonical workspace overview page at `w/[slug]` plus deterministic default landing into it (done in `add-workspace-overview-and-default-landing`),
2. a shared private workspace shell for workspace-scoped routes — sidebar, thin header with a reserved search position, breadcrumb band, `CommandDialog` with an honest pre-launch empty state (this change),
3. workspace-scoped shell-level upload entry points (global drag-and-drop, header upload control) plus a persistent bottom-right upload manager that rehydrates from non-terminal transcripts (the next change), and
4. moving authenticated `/account/security` and `/account/close` into the shared shell with default-workspace context resolution and a non-workspace breadcrumb root (the last change).

This change introduces the shell chrome only. It does not ship upload entry points, it does not ship the upload manager, and it does not yet host account routes. Those are the two follow-ups. Calling the deferrals out explicitly keeps this change reviewable and keeps the shell honest about what it does — and does not — deliver on day one.

## Context

`add-workspace-overview-and-default-landing` established `w/[slug]` as the canonical workspace home and reduced `/dashboard` to an authenticated redirect. The authenticated web surface still looks like independent pages with their own centered layouts though — `w/[slug]/transcripts`, `w/[slug]/transcripts/[transcriptId]`, `w/[slug]/meetings/new`, `w/[slug]/meetings/[transcriptId]`, and now `w/[slug]` itself all render their own `main` element inside `app/layout.tsx` without any shared chrome, navigation, workspace identity, or reserved search surface.

This change introduces the shared workspace shell that wraps those workspace-scoped routes. It uses the shadcn `sidebar-16` composition pattern as a starting point and adapts it to Audio Recap's actual navigation depth and to the product's deliberate decision to reserve — but not yet ship — a workspace search experience. The shell is deliberately narrow in scope: chrome only, workspace-scoped routes only, no shell-level upload chrome, no account-page routing changes.

The shell's workspace context comes directly from the `w/[slug]` route segment. This change does not need to teach the shell how to resolve a workspace in the absence of an explicit slug — that is the problem the account-pages change will solve once it needs it.

## Goals / Non-Goals

**Goals:**

- Introduce a private route-group structure that hosts a shared authenticated shell above all workspace-scoped routes, using `sidebar-16` as the starting composition pattern.
- Deliver a three-region sidebar (workspace switcher + Overview/Transcripts nav + user footer) that supports `collapsible="icon"` and preserves every destination in the icon-collapsed state.
- Deliver a thin header ribbon that reserves the right-side search slot as a non-input icon affordance with a visible kbd hint adapted to the user's platform, a theme toggle, and a user menu.
- Render the breadcrumb band inside `SidebarInset` above page content, always beginning with the current workspace name on workspace-scoped routes, with explicit truncation rules (final crumb first, then middle-crumb ellipsis), and allow pages to push a human-readable label for the final crumb.
- Wire the reserved header search slot to a shadcn `CommandDialog` with a real `Command` + `CommandInput` but no `CommandItem`s — only a `CommandEmpty` pre-launch state that reacts honestly to typing and is reachable by both icon click and `⌘K` / `Ctrl+K`.
- Keep shell chrome stable across overview, transcript library, transcript detail, dedicated meeting submission, and dedicated meeting status.
- Respect existing transcript edit sessions: the `⌘K` shortcut MUST NOT hijack keystrokes while an active transcript edit session owns focus.

**Non-Goals:**

- Ship any upload entry points (drag-and-drop overlay, header upload control) or the persistent bottom-right upload manager. These belong to `add-shell-upload-entry-points-and-manager`.
- Host `/account/security` and `/account/close` inside the shell. This belongs to `add-account-pages-inside-shell` and requires additional shell contracts (non-workspace breadcrumb root, default-workspace resolution for non-workspace shell routes).
- Render the shell around public share routes, authentication routes, `/account/recent-auth`, `/account/closed`, or `/dashboard`.
- Implement actual workspace search. The reserved header slot and the `CommandDialog` empty state are pre-launch surfaces only.
- Redesign the existing dedicated submission or dedicated status pages beyond moving them under the shared shell and removing their local centered `main` layouts.
- Introduce new server-side contracts; this change is layout and chrome only and continues to use existing server reads, including the workspace-scoped transcript library read for the sidebar's transcripts count.

## Decisions

### Decision: Build the shell around route groups and a workspace layout

The implementation will introduce a private route-group structure that keeps URLs stable while giving signed-in workspace pages a shared layout. Concretely:

- a private route group hosts the shared authenticated shell chrome (sidebar, header, breadcrumb band, providers) above every workspace-scoped route.
- `w/[slug]/layout.tsx` sits inside that private route group and establishes the explicit current-workspace context from the route slug.
- `w/[slug]/page.tsx` becomes the workspace overview page rendered inside the shared shell.
- transcript library, transcript detail, dedicated submit, and dedicated meeting-status routes remain nested under the workspace layout and now render inside the shared shell.

Because this change only hosts workspace-scoped routes inside the shell, it does not yet need a non-workspace provider layer. The shell's current-workspace context always comes from the `w/[slug]` segment.

**Why this over alternatives**

- Over leaving each page to render its own top-level layout: cross-page shell state (sidebar collapse, theme toggle, breadcrumb band) becomes brittle and duplicated.
- Over mounting the shell at the global `app/layout.tsx`: public share pages and authentication pages must remain visually separate and must not inherit private workspace chrome.
- Over generalizing the shell to non-workspace routes in this change: doing so would force the `/account/*` relocation (which requires default-workspace context resolution and a non-workspace breadcrumb root) into an already-dense shell change.

### Decision: Visual adaptation of `sidebar-16` — minimalist sidebar, thin header, breadcrumb band above content, `CommandDialog` for the reserved search slot

The shell keeps the `sidebar-16` geometry (sticky full-width site header above an inset sidebar + content region) but deliberately reduces information density to match Audio Recap's actual navigation depth and the reserved (not-yet-functional) search slot. The stock `sidebar-16` scaffolding assumes four sidebar groups and a functional header search input; this product has two nav destinations and no search yet, so the defaults would read as under-furnished chrome if left unchanged.

Concrete shape:

- **Sidebar.** Three regions. Top: a workspace switcher, because `workspace-foundation` explicitly supports multi-membership and workspace identity must be visible from the shell. Middle: exactly two nav destinations — Overview and Transcripts, with the transcripts destination carrying the total library count as a subtle density cue grounded in real data. Footer: user identity and account actions. The sidebar MUST support `collapsible="icon"` so users can reclaim horizontal space on reading-heavy transcript surfaces; the three regions collapse to icon-only equivalents without losing any destination.
- **Header.** Thin ribbon only. Left: sidebar trigger + brand; the brand renders as logo mark + wordmark when the sidebar is expanded and collapses to mark-only when the sidebar is icon-collapsed, so the header's left edge stays proportionate to the sidebar width. Right: a search icon that carries a visible `⌘K` kbd hint (the reserved header search affordance), the theme toggle, and the user menu. The center is intentionally empty — no breadcrumb, no input, no pseudo-controls — because the reserved search position is the only thing that belongs there structurally and this change is not shipping search. The theme toggle lives in the header rather than inside the user menu so the read/write tone can be flipped without opening a menu. Both the visible kbd hint and the actual shortcut MUST adapt to the user's platform (`⌘K` on macOS, `Ctrl+K` elsewhere).
- **Breadcrumb band.** Rendered inside `SidebarInset` as its own sticky region just above the page content, not inside the header. On desktop this band is content-width (sits to the right of the sidebar); on mobile — where the sidebar is hidden behind a sheet — it spans the full viewport width and stays always visible. The breadcrumb always begins with the current workspace name on workspace-scoped routes so workspace identity is never lost, especially on mobile where the sidebar's workspace switcher is behind the trigger. Truncation priority: the final (page-title) crumb truncates first with a full-title tooltip; if the chain still overflows, middle crumbs collapse into a `BreadcrumbEllipsis` dropdown; the workspace root crumb never shrinks. Pages MAY push a human-readable label for the final crumb (for example a transcript's display title) so the band never shows a raw id. The band MUST NOT carry live processing state in this change or in future changes — processing state belongs to the upload manager that lands in the next change, and duplicating it into the breadcrumb would re-introduce drift risk.
- **Reserved header search slot.** The header slot itself stays a non-input icon button. Clicking the icon, or pressing `⌘K` / `Ctrl+K` from anywhere in the shell, opens the shadcn `CommandDialog` (centered modal, identical composition on desktop and mobile). The dialog contains a real `Command` with a real `CommandInput`, but no `CommandItem`s — only a `CommandEmpty` state that tells users search is on its way and reacts honestly to typing (for example echoing the query with "nothing to search yet"). The `⌘K` shortcut MUST NOT open the dialog when the active element is an input or textarea inside an active transcript edit session, so the editing workflow is not hijacked. The dialog is a distinct surface from the reserved header position; the header position remains a non-input affordance and the modal is honestly labeled as pre-launch.

**Why this over alternatives**

- Over filling the sidebar middle with live activity (active work, recent transcripts): the workspace overview already surfaces that data, and duplicating it into the sidebar would create drift risk and user confusion about which surface is authoritative.
- Over putting the breadcrumb inside the header: on mobile the header is tight, and the breadcrumb's final crumb (a meeting title) can be long. Rendering it as a separate sticky band below the header gives it the horizontal room it needs, keeps it always visible on mobile, and keeps the header geometry stable regardless of route depth.
- Over a disabled pseudo-input in the header search slot: a disabled input still invites typing that goes nowhere. An icon that opens a `CommandDialog` with an honest empty state behaves consistently with the post-launch shape — same trigger, same surface, same muscle memory — and lets the UI say out loud that search is coming.
- Over a `Popover` anchored to the search icon: `CommandDialog` is the standard cmdk / `⌘K` idiom and works identically on desktop and mobile without separate code paths; an anchored popover would feel cramped on mobile and non-standard on desktop.
- Over hiding the theme toggle inside the user menu: the toggle is a frequent, reversible action on a read-heavy product and belongs in the always-visible header.

### Decision: Scope this change to workspace-scoped routes only

The shared shell in this change wraps only workspace-scoped routes: `w/[slug]`, `w/[slug]/transcripts`, `w/[slug]/transcripts/[transcriptId]`, `w/[slug]/meetings/new`, `w/[slug]/meetings/[transcriptId]`. Public share routes, authentication routes, `/dashboard`, `/account/security`, `/account/close`, `/account/recent-auth`, and `/account/closed` all remain outside the shell in this change.

Authenticated `/account/security` and `/account/close` will move inside the shell in the follow-up change `add-account-pages-inside-shell`. Generalizing the shell to those routes requires two additional contracts that do not belong in this change:

- a non-workspace breadcrumb root (account pages have no `[slug]`, so the "always begins with the current workspace name" rule needs a non-workspace variant like an `Account` root that does not shrink),
- a default-workspace context resolution for non-workspace shell routes (so the sidebar workspace switcher, theme toggle, and — later — the upload chrome point at a resolved workspace while the user is on an account page).

Keeping those contracts out of this change lets the shell ship with one well-defined rule (workspace identity comes from the route slug) and keeps this change strictly about chrome.

**Why this over alternatives**

- Over shipping the shell around account pages in this change: the non-workspace breadcrumb root and default-workspace resolution are structural contracts worth their own proposal, and mixing them into shell introduction doubles the review surface.
- Over never hosting account pages inside a shell: the account-pages change explicitly argues for the shell-hosted approach; this change just defers that decision's implementation.

### Decision: The sidebar's transcripts count reuses the existing workspace transcript read

The sidebar's middle nav shows a total library count next to the transcripts destination as a subtle density cue. The count is read from the existing workspace-scoped transcript library read used by `private-transcript-library`; no new endpoint is introduced. The count is fetched once per shell mount for the current workspace and cached in a provider used by the sidebar, so that navigating inside the shell does not refetch it on every route transition.

**Why this over alternatives**

- Over inventing a dedicated sidebar-count endpoint: the data already exists in the workspace transcript library read, and creating a parallel count source risks drift.
- Over recomputing the count on every navigation: the number is a density cue, not a live counter, and recomputing it per transition would be wasteful and could produce flicker.

## Risks / Trade-offs

- [Migrating existing workspace pages into the shared shell can produce layout regressions on transcript detail or meeting status] -> Migrate pages incrementally inside this change and keep their content containers close to the current widths so typography and spacing do not shift meaningfully.
- [A reserved search position can feel empty or purposeless before search ships] -> Ship the header slot as a non-input icon with a kbd hint, and the `CommandDialog` as an honest pre-launch empty state; avoid disabled-input affordances that invite typing that goes nowhere.
- [The `⌘K` shortcut could collide with transcript edit shortcuts] -> Suppress the shortcut while the active element is an input or textarea inside an active transcript edit session.
- [Installing shadcn `sidebar` and `command` may touch shared configuration] -> Follow the shadcn skill to add the components so the install stays in line with this repo's conventions; do not hand-roll composition that the skill covers.
- [Sidebar count could drift from the actual transcript library total] -> Derive it from the existing workspace transcript library read so the shell count and the library count share one source.
- [Breadcrumb band could creep into hosting processing state as the upload manager lands] -> Keep the band strictly a navigation/identification band in this change and defer all live processing surface to the upload manager in the next change.

## Migration Plan

1. Install shadcn `sidebar` and `command` components via the shadcn skill and compose them locally; do not inline third-party templates.
2. Introduce the private route-group structure and a shared workspace shell layout, and mount `SidebarProvider` configured for `collapsible="icon"`.
3. Build the sidebar (workspace switcher, Overview + Transcripts nav with the transcripts count, user footer) and verify every region renders in the icon-collapsed state.
4. Build the header (brand + sidebar trigger, reserved search icon with platform-adaptive kbd hint, theme toggle, user menu); leave the center empty.
5. Add the breadcrumb band inside `SidebarInset` above page content with the workspace root rule and the truncation priority rules.
6. Wire the reserved header search slot to a `CommandDialog` with `Command` + `CommandInput` + `CommandEmpty`, opened by icon click and by the platform-adapted shortcut; suppress the shortcut inside active transcript edit sessions.
7. Move `w/[slug]` overview, `w/[slug]/transcripts`, `w/[slug]/transcripts/[transcriptId]`, `w/[slug]/meetings/new`, and `w/[slug]/meetings/[transcriptId]` into the shared shell and remove their local centered `main` layouts.
8. Add regression coverage for shell composition, breadcrumb truncation, reserved search behavior, and route boundaries (shell-hosted vs not-shell-hosted routes).

Rollback strategy:

- the shared shell can be swapped for a pass-through layout that just renders children if the shell composition needs to be temporarily withdrawn; existing server contracts for the underlying pages are unchanged.
- the reserved header search slot can be reduced to the icon without the `CommandDialog` if the dialog misbehaves, because no product capability depends on the dialog.
- workspace-scoped URLs remain stable regardless of shell state, so rollback does not affect bookmarks or shared links.

## Open Questions

None open. The account-page relocation question raised in the earlier combined proposal is fully deferred to `add-account-pages-inside-shell`, which owns the non-workspace breadcrumb root and default-workspace resolution work required to generalize this shell beyond `w/[slug]`.
