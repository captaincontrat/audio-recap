## Why

After `add-workspace-overview-and-default-landing` introduces a canonical `w/[slug]` home and `/dashboard` redirects into it, the authenticated experience is still organized as independent pages with their own centered layouts. There is no shared private shell, so workspace identity, navigation between workspace surfaces, and the eventual reserved header search position have no stable home, and upcoming shell-level upload work has no shell to attach to.

This change introduces the permanent private workspace shell for workspace-scoped routes only: a shared layout wrapping `w/[slug]` and every route underneath it, built from the `sidebar-16` composition pattern and adapted to Audio Recap's actual navigation depth. It does not yet introduce any of the shell-level upload chrome (drop overlay, header upload control, persistent upload manager) and it does not yet host `/account/*` routes. Those are the responsibility of the next two changes in this initiative, and are called out as explicit deferrals below so the shell is never mistaken for a finished product surface.

## What Changes

- Add a private route-group structure that mounts a shared authenticated shell above all workspace-scoped routes (`w/[slug]`, transcript library, transcript detail, dedicated meeting submission, dedicated meeting status).
- Configure a `SidebarProvider` that supports `collapsible="icon"` so users can reclaim horizontal space on reading-heavy transcript surfaces without losing any destination.
- Build a three-region sidebar: a workspace switcher at the top (because `workspace-foundation` explicitly supports multi-membership and workspace identity must be visible from the shell), a deliberately short middle nav limited to Overview and Transcripts (with the transcripts destination carrying the current workspace's total library count as a subtle density cue grounded in real data), and a user footer with account actions.
- Build a thin header ribbon: left side carries the sidebar trigger plus a brand that renders as logo mark + wordmark when the sidebar is expanded and collapses to mark-only when the sidebar is icon-collapsed; right side carries a search icon that occupies the reserved search position with a visible kbd hint (`⌘K` on macOS, `Ctrl+K` elsewhere), the theme toggle, and the user menu. The header center stays intentionally empty in this change.
- Add a sticky breadcrumb band inside `SidebarInset` directly above page content: content-width on desktop, full-viewport-width on mobile, always beginning with the current workspace name on workspace-scoped routes. Truncation priority: the final crumb shrinks first with a full-title tooltip, middle crumbs collapse into a `BreadcrumbEllipsis` dropdown if the chain still overflows, and the workspace root crumb never shrinks. Pages MAY push a human-readable label for the final crumb (for example a transcript's display title).
- Wire the reserved header search slot to a shadcn `CommandDialog` that opens on icon click or `⌘K` / `Ctrl+K` from anywhere in the shell. The dialog MUST render a real `Command` + `CommandInput` but no `CommandItem`s — only a `CommandEmpty` pre-launch state that reacts honestly to typing (for example echoing the query as "nothing to search yet"). Suppress the shortcut while an active transcript edit session owns focus.
- Keep shell chrome stable across overview, transcript library, transcript detail, dedicated meeting submission, and dedicated meeting status. Migrate those routes out of their current standalone centered layouts into the shared shell.

## Explicit deferrals

This change is deliberately narrow. The following shell-adjacent behaviors do NOT ship here and are the responsibility of later changes:

- **Upload entry points (drag-and-drop overlay, header upload control) and the persistent bottom-right upload manager** — these land in `add-shell-upload-entry-points-and-manager`. Without them, the shell intentionally ships without any upload chrome. The "Submit a meeting" entry point for users with transcript-creation access continues to be the existing dedicated submission page, reachable through the overview's start-upload CTA and through direct links.
- **Authenticated `/account/security` and `/account/close` pages rendering inside this shell** — these land in `add-account-pages-inside-shell`. Until then, those pages continue to render with their current bare layouts. The shell in this change only hosts workspace-scoped routes.

Those deferrals are intentional so this change stays reviewable and so the shell is proven on workspace-only routes (which have a slug available natively) before it is generalized to non-workspace routes.

## Capabilities

### New Capabilities

- `workspace-app-shell`: Shared authenticated shell for workspace-scoped private routes, with persistent sidebar and thin header chrome, workspace-aware navigation, a breadcrumb band that always begins with the current workspace name, and a reserved header search position that ships as a non-input icon affordance plus a shadcn `CommandDialog` with an honest pre-launch empty state.

### Modified Capabilities

- `workspace-overview`: The overview route's "renders inside the shared workspace shell" behavior becomes true once this change lands, so the overview's existing "accessible overview route" requirement is MODIFIED to record that the overview renders inside the shared shell on workspace-scoped routes. No change to the overview's default-landing role, its activity groups, or its CTAs.

## Impact

- `app/` gains a private route group that hosts the shared shell (`SidebarProvider`, `Sidebar`, `SidebarInset`, header ribbon, breadcrumb band, `CommandDialog`) above every workspace-scoped route. Shadcn `sidebar` and `command` primitives are installed via the shadcn skill and composed locally in this change.
- The existing workspace-scoped pages (`w/[slug]` overview, `w/[slug]/transcripts`, `w/[slug]/transcripts/[transcriptId]`, `w/[slug]/meetings/new`, `w/[slug]/meetings/[transcriptId]`) move under the shared shell. Their page components lose their local centered `main` layouts and instead render inside `SidebarInset` below the shell header and the breadcrumb band. The existing URL structure and server-side data contracts are unchanged.
- Public share routes, authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor), and account routes (`/account/security`, `/account/close`, `/account/recent-auth`, `/account/closed`) remain outside the shared shell in this change. `/dashboard` remains a redirect-only entry point and does not render the shell itself.
- The reserved header search slot ships as a non-input icon button with a visible kbd hint. The `CommandDialog` opens from both the icon and the `⌘K` / `Ctrl+K` shortcut, and the dialog's `CommandEmpty` state honestly signals pre-launch behavior when the user types. No workspace search query is executed in this change.
- No upload entry points, no drop overlay, no header upload control, and no persistent upload manager are introduced here. No changes to the transcript-processing contract, the submission orchestration (`submitMeeting()`), or the workspace-scoped status reads happen in this change.
- Later work can attach shell-level upload chrome and generalize the shell to account-page routes without redesigning the header, sidebar, breadcrumb band, or reserved search slot established here.
