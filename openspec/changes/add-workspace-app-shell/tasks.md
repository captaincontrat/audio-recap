## 1. Shell scaffolding and providers

- [ ] 1.1 Install shadcn primitives using the shadcn skill in `.agents/skills/shadcn/SKILL.md`: start from the `sidebar-16` block (`pnpm dlx shadcn@latest add @shadcn/sidebar-16`, which transitively installs `sidebar`, `breadcrumb`, `separator`, `collapsible`, `dropdown-menu`, `avatar`, `button`, `label`), then add `command`, `tooltip`, `kbd`, and `sonner`. Adapt the block per the deltas in `design.md` (move the breadcrumb out of the header into a separate band, replace the search input with an icon + `CommandDialog`, reduce the four nav groups to one with two destinations, swap `IconPlaceholder` for `@remixicon/react` icons, replace `<a href>` with `next/link` via `asChild`). Do not hand-roll composition the block or skill already covers.
- [ ] 1.2 Introduce a private route-group structure under `app/app/` that hosts the shared authenticated shell above workspace-scoped routes, and add a shared workspace-shell layout that mounts `SidebarProvider` configured for `collapsible="icon"`.
- [ ] 1.3 Keep the existing `app/app/layout.tsx` as the root layout with theme and locale providers. Do not move theme / locale providers into the shell; they continue to live above it.

## 2. Sidebar

- [ ] 2.1 Build the sidebar with three regions: a workspace switcher at the top (reflecting multi-workspace membership from `workspace-foundation`), a middle nav limited to Overview and Transcripts (with the transcripts destination showing the current workspace's total library count read from the existing workspace transcript library read), and a user footer with account actions.
- [ ] 2.2 Verify every region renders correctly in the icon-collapsed state and that no destination disappears when the sidebar collapses to the icon rail.
- [ ] 2.3 Source the transcripts count from the existing workspace transcript library read; do not introduce a new server endpoint for the count. Cache the count in a shell-level provider so it does not refetch on every intra-shell navigation.

## 3. Header ribbon

- [ ] 3.1 Build the header as a thin ribbon: left side carries the sidebar trigger and a brand that renders as logo mark + wordmark when the sidebar is expanded and collapses to mark-only when the sidebar is icon-collapsed; right side carries a search icon with a visible kbd hint (`⌘K` on macOS, `Ctrl+K` elsewhere), the theme toggle, and the user menu. Keep the header center intentionally empty in this change.
- [ ] 3.2 The theme toggle lives in the header and MUST NOT be moved into the user menu; this preserves the read/write tone toggle as a frequent, reversible action.

## 4. Breadcrumb band

- [ ] 4.1 Add a sticky breadcrumb band inside `SidebarInset` directly above page content: content-width on desktop, full-viewport-width on mobile.
- [ ] 4.2 On workspace-scoped routes the breadcrumb MUST always start with the current workspace name.
- [ ] 4.3 Implement truncation so the final (page-title) crumb shrinks first with a full-title tooltip, middle crumbs collapse into a `BreadcrumbEllipsis` dropdown if the chain still overflows, and the workspace root crumb never shrinks.
- [ ] 4.4 Allow pages to push a human-readable label for the final crumb (for example a transcript's display title) so the band never shows a raw id.
- [ ] 4.5 The breadcrumb band MUST NOT carry live processing state; processing state stays out of the band in this change and in future changes.

## 5. Reserved header search slot

- [ ] 5.1 Wire the reserved header search slot to a shadcn `CommandDialog` that opens on icon click or `⌘K` / `Ctrl+K` from anywhere in the shell.
- [ ] 5.2 The dialog MUST render a real `Command` + `CommandInput` but no `CommandItem`s — only a `CommandEmpty` pre-launch state that reacts honestly to typing (for example echoing the query as "nothing to search yet").
- [ ] 5.3 Suppress the `⌘K` / `Ctrl+K` shortcut while the active element is an input or textarea inside an active transcript edit session, so the editing workflow is not hijacked.

## 6. Migrate workspace-scoped pages into the shell

- [ ] 6.1 Move `w/[slug]/page.tsx` (overview), `w/[slug]/transcripts/page.tsx`, `w/[slug]/transcripts/[transcriptId]/page.tsx`, `w/[slug]/meetings/new/page.tsx`, and `w/[slug]/meetings/[transcriptId]/page.tsx` so their content renders inside the shared shell.
- [ ] 6.2 Remove the local centered `main` layouts from those pages and let the shared shell's `SidebarInset` own the top-level page frame.
- [ ] 6.3 Do not move public share routes, authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor), `/account/security`, `/account/close`, `/account/recent-auth`, `/account/closed`, or `/dashboard` inside the shared shell in this change.

## 7. Regression coverage

- [ ] 7.1 Add UI or integration coverage for shell composition: the sidebar preserves all three regions when icon-collapsed; the header brand shows mark + wordmark when the sidebar is expanded and collapses to mark-only when icon-collapsed.
- [ ] 7.2 Add coverage that the breadcrumb band always begins with the current workspace name on workspace-scoped routes, truncates the final crumb first with a full-title tooltip, collapses middle crumbs into `BreadcrumbEllipsis` when the chain overflows, and never shrinks the workspace root crumb.
- [ ] 7.3 Add coverage that the `CommandDialog` opens from both the search icon and the platform-adapted shortcut, that its `CommandEmpty` state reacts honestly to typing, and that the shortcut is suppressed while an active transcript edit session owns focus.
- [ ] 7.4 Add coverage that public share routes, authentication routes, `/account/security`, `/account/close`, `/account/recent-auth`, `/account/closed`, and `/dashboard` remain outside the shared shell in this change.
