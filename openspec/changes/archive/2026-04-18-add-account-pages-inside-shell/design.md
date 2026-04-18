## Overall initiative recap

This change is the fourth and final step of a four-part initiative that turns the authenticated web surface into a real workspace product. The full initiative introduces:

1. a canonical workspace overview page at `w/[slug]` plus deterministic default landing into it (done in `add-workspace-overview-and-default-landing`),
2. a shared private workspace shell for workspace-scoped routes — sidebar, thin header with a reserved search position, breadcrumb band, `CommandDialog` with an honest pre-launch empty state (done in `add-workspace-app-shell`),
3. workspace-scoped shell-level upload entry points (global drag-and-drop, header upload control) plus a persistent bottom-right upload manager that rehydrates from non-terminal transcripts (done in `add-shell-upload-entry-points-and-manager`), and
4. moving authenticated `/account/security` and `/account/close` into the shared shell with default-workspace context resolution and a non-workspace breadcrumb root (this change).

This change is deliberately small. It generalizes the shared shell that the previous changes built to also host authenticated account-settings pages, which closes the biggest remaining "why is my settings page a bare centered form again?" gap in the signed-in product.

## Context

After `add-workspace-app-shell` and `add-shell-upload-entry-points-and-manager`, every workspace-scoped private route renders inside the shared shell, and the shell hosts workspace-scoped upload chrome. `/account/security` and `/account/close` still use their old bare centered layouts. Once a user opens account settings mid-session, the sidebar, header, breadcrumb band, theme toggle, workspace switcher, and upload chrome all disappear, and they come back only when the user returns to a workspace route. That creates a confusing in/out feeling and encourages the illusion that leaving the shell means leaving the product.

Two contracts are missing before these pages can join the shell:

- A **non-workspace breadcrumb root**: the breadcrumb-band rule introduced in `add-workspace-app-shell` says the breadcrumb always begins with the current workspace name on workspace-scoped routes. Applied blindly to `/account/security`, it would suggest security settings belong to whichever workspace happened to be resolved. Account pages need their own root (for example `Account`) that does not shrink, while the truncation priority for subsequent crumbs stays the same.
- A **default-workspace context resolution for non-workspace shell routes**: workspace-scoped shell features (sidebar workspace switcher, header upload control, drop overlay, upload-manager rehydration) all need a current workspace to target. Account routes have no `[slug]`, so the shell needs to resolve a workspace using the same default-workspace logic used by the `/dashboard` redirect entry point.

This change adds exactly those two contracts and then moves `/account/security` and `/account/close` into the shell.

## Goals / Non-Goals

**Goals:**

- Host `/account/security` and `/account/close` inside the shared shell.
- Resolve a current workspace context for the shell on account routes using the default-workspace resolution defined by `workspace-foundation` for authenticated entry without an explicit workspace destination.
- Keep account URLs single and canonical (`/account/security`, `/account/close`); do not multiply them across workspace slugs.
- Add a non-workspace breadcrumb root (for example `Account`) for account shell routes. Keep the truncation priority unchanged from `add-workspace-app-shell`.
- Keep step-up auth gates (`/account/recent-auth`), the post-closure landing (`/account/closed`), `/dashboard`, authentication routes, and public share routes outside the shared shell.
- Make the upload chrome introduced in `add-shell-upload-entry-points-and-manager` behave predictably on account routes: target the resolved default workspace, inherit archived / read-only rules from that workspace.

**Non-Goals:**

- Redesign the `/account/security` or `/account/close` pages themselves. Their internal components (passkey manager, two-factor settings, close-account controls) render inside the shell without visual redesign in this change.
- Move step-up auth gates (`/account/recent-auth`) or the post-closure landing (`/account/closed`) into the shell.
- Move `/dashboard` into the shell; it remains a redirect-only entry point.
- Introduce account-scoped navigation destinations in the sidebar. The sidebar's middle nav stays limited to Overview and Transcripts for the resolved workspace.
- Introduce a shell-level view that aggregates account settings across all workspaces; account pages are user-scoped, not workspace-scoped.

## Decisions

### Decision: Host authenticated `/account/*` settings pages inside the shared shell

Authenticated account-settings pages (`/account/security`, `/account/close`) render inside the shared shell, matching the standard SaaS pattern where post-authentication settings are ordinary app surfaces rather than bare centered pages. This keeps the sidebar workspace switcher, header upload control, drop overlay, upload manager, and breadcrumb-band chrome consistent while a signed-in user flips between doing product work and adjusting their account.

Step-up auth gates (`/account/recent-auth`) and the post-closure landing (`/account/closed`) remain outside the shell. The former is the re-auth prompt itself and benefits from a focused, distraction-free layout; the latter is reached after sessions are revoked, so the user is effectively not authenticated and a workspace-chromed page would misrepresent their state. All pre-authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor) and public share routes also stay outside the shell.

**Why this over alternatives**

- Over keeping `/account/*` as bare centered pages: the standard SaaS pattern for post-authentication settings is the normal app shell; a bare layout implies the user has left the product, which is misleading for in-session settings changes. Destructive-action protection comes from explicit confirmation affordances and step-up auth, not from the absence of a sidebar.
- Over moving account pages to `w/[slug]/account/*`: it would multiply account URLs by workspace membership and make "security" feel like a per-workspace setting rather than a per-user one.
- Over introducing a thin private provider layer that account pages opt into without the shell chrome: no shared client provider exists today to populate such a layer (theme and locale live in the root layout; account pages fetch session server-side per request because of step-up auth). An empty structural layer creates false symmetry without delivering it.

### Decision: Workspace context on account shell routes comes from default-workspace resolution, and the breadcrumb uses a non-workspace root

To host non-workspace content cleanly, the shell extends two rules originally established for workspace routes:

- **Workspace context resolution.** `/account/*` URLs carry no `[slug]`, so on those routes the shell resolves a current workspace using the same default-workspace resolution used by the `/dashboard` entry point (last successfully used accessible active workspace, otherwise the user's personal workspace). The sidebar workspace switcher, header upload control, drop overlay, and upload-manager rehydration all target that resolved workspace while the user is on an account page. The URL itself stays global, so account pages are not multiplied across workspace slugs.
- **Breadcrumb root for non-workspace routes.** The workspace-scoped breadcrumb rule ("always begins with the current workspace name") applies to workspace routes only. For account routes inside the shell, the breadcrumb begins with a content root (for example `Account`) and workspace identity is carried by the sidebar workspace switcher alone. The truncation rules (final crumb shrinks first, middle crumbs collapse into an ellipsis dropdown) apply unchanged, with the account root crumb never shrinking.

**Why this over alternatives**

- Over rendering the breadcrumb with the resolved workspace name as its root on account pages: it would imply account settings belong to that workspace, which contradicts the user-scoped identity of security and close-account pages.
- Over hiding the breadcrumb entirely on account pages: it would make shell geometry inconsistent and would lose the navigation cue back up to the account root.
- Over renaming the shell's current-workspace context to something more generic: workspace-scoped features (upload, sidebar switcher) still need a concrete workspace to target; default-workspace resolution preserves that while keeping account URLs global.

### Decision: Upload chrome on account routes targets the resolved default workspace and inherits its rules

Because the shared shell hosts workspace-scoped upload chrome introduced in `add-shell-upload-entry-points-and-manager`, account routes inside the shell need a consistent answer to "what workspace does an upload go to?" The answer is: the resolved default workspace. Specifically:

- the drop overlay identifies the resolved default workspace as the target,
- the header upload control opens a drop-then-confirm handoff associated with the resolved default workspace,
- the upload manager rehydrates from the resolved default workspace's non-terminal transcripts,
- if the resolved default workspace is archived or the current user has read-only access there, the existing archived / read-only shell rules apply and the shell does not accept queueable submissions.

This keeps the upload story coherent regardless of whether the user is on a workspace route or an account route, without introducing a second upload-target rule.

**Why this over alternatives**

- Over disabling the upload chrome entirely on account routes: it would create a second behavior mode for the shell and surprise users who want to quickly drop a file while glancing at settings.
- Over aggregating uploads across all workspaces the user belongs to: the upload manager's workspace-keyed contract exists precisely to prevent cross-workspace mixing; account pages must not undo that contract.
- Over asking the user to pick a target workspace explicitly when they drop on an account route: users already selected a workspace earlier, and the default-workspace resolution encodes that last-selected state.

## Risks / Trade-offs

- [Users on `/account/close` might be confused if an upload is queued mid-deletion flow] -> Close-account flows are step-up gated and the resolved workspace is the one they were working in; archival / account-lifecycle changes (owned by other capabilities) determine when submissions remain accepted. This change does not relax any of those rules.
- [The breadcrumb's `Account` root could be mistaken for a sidebar destination] -> The sidebar continues to show only Overview and Transcripts for the resolved workspace; the breadcrumb root for account pages is label-only and does not add a sidebar item.
- [If default-workspace resolution fails because every workspace the user can access is archived, the upload chrome could show an inactive state on account routes] -> The existing archived rules from `add-shell-upload-entry-points-and-manager` cover this cleanly: no accepting drop target, no active header upload control. The user can still use account settings normally.
- [Future account routes might want a route-specific provider surface] -> This change generalizes the shell to account routes without committing to route-specific providers; later work can add them on top if needed.

## Shadcn building blocks

This change is the lightest of the four on shadcn. The existing shell, breadcrumb, and upload chrome were installed by `add-workspace-app-shell` and `add-shell-upload-entry-points-and-manager`. Account pages keep their existing internal components (`TwoFactorSettings`, `PasskeyManager`, the close-account form) — this change only changes their hosting layer.

| Use on account shell routes | Component | Already installed? | CLI |
| --- | --- | --- | --- |
| Account breadcrumb root crumb (`Account`) — first crumb on `/account/security` and `/account/close`. Compose from the existing `Breadcrumb` family (`BreadcrumbList` + `BreadcrumbItem` + `BreadcrumbLink` + `BreadcrumbSeparator` + `BreadcrumbPage`). The `BreadcrumbEllipsis` middle-collapse rule from the shell change applies unchanged. | `breadcrumb` | Yes (shell change, transitively via `sidebar-16`) | — |
| Sidebar workspace switcher continues to render on account routes, targeting the resolved default workspace. Reuse the same composed `DropdownMenu` + `SidebarMenuButton` switcher built in `add-workspace-app-shell`. | `sidebar`, `dropdown-menu` | Yes (shell change) | — |
| Header upload control, drop overlay, and bottom-right upload manager continue to render on account routes, targeting the resolved default workspace. Reuse the components built in `add-shell-upload-entry-points-and-manager`. When the resolved default workspace is archived or read-only, the existing rules disable / hide them — no new component work. | `card`, `badge`, `progress`, `collapsible`, `scroll-area`, `tooltip`, `sonner`, `button` | Yes (upload change) | — |
| Account-page section containers (existing `<section>` blocks for two-factor, passkeys, close-account). Once they sit inside `SidebarInset`, prefer migrating any remaining ad-hoc `<section className="rounded-lg border">` wrappers to `Card` for visual consistency with the rest of the shell-hosted product. This is OPTIONAL and can land as a follow-up; keeping the existing markup is acceptable for this change. | `card` (optional refresh) | Yes (overview change) | — |

No new `pnpm dlx shadcn@latest add` invocation is required for this change. Run `pnpm dlx shadcn@latest info --json` once before starting to confirm the dependency set is the union of the previous three changes.

### Composition notes for the implementer

- **Account root crumb label.** Localize the root crumb (e.g. `chrome.shell.breadcrumb.accountRoot`) using the existing i18n surface. Do NOT hardcode `Account`. Match the truncation behavior in the shell change: the root crumb never shrinks; the final crumb (e.g. `Security`, `Close account`) shrinks first with a full-title `Tooltip`.
- **No new sidebar destination.** Tasks 2.3 and the design's non-goals are explicit: the sidebar middle nav stays exactly two destinations (Overview, Transcripts) for the resolved workspace. Account pages are reachable through the user-menu in the sidebar footer (composed via `DropdownMenu` in `add-workspace-app-shell`), not via a third nav group.
- **Remove the bare `<main className="mx-auto max-w-xl ...">` wrappers.** Account pages currently render their own centered `main`. Inside the shared shell, the page should render directly into `SidebarInset` and let the shell own the top-level frame. Use a content container like `<div className="mx-auto w-full max-w-2xl flex flex-col gap-6 p-6">` only if needed for content width.
- **Upload chrome inheritance.** No conditional code in the upload manager / drop overlay should know about account routes specifically. The chrome consumes the workspace context provider and behaves identically on workspace routes and on account routes; only the provider's source (explicit slug vs default-workspace resolver) differs.
- **Forbidden patterns.** Do NOT introduce a route-specific provider just for account pages (Decisions section: an empty structural layer creates false symmetry). Do NOT create an `Account` sidebar group. Do NOT render the breadcrumb without a root crumb on account routes.

## Migration Plan

1. Add default-workspace context resolution for non-workspace shell routes, reusing the logic used by the `/dashboard` redirect entry point (last successfully used accessible active workspace, otherwise the user's personal workspace). Surface that context to the shell's providers alongside the existing workspace-route context.
2. Add a non-workspace breadcrumb root variant (for example `Account`) to the breadcrumb band. Keep the truncation priority unchanged; the account root never shrinks.
3. Move `/account/security/page.tsx` and `/account/close/page.tsx` under the private route group that hosts the shared shell, removing their bare centered layouts. Keep `/account/recent-auth` and `/account/closed` outside the shell.
4. Verify that the shell-level upload chrome targets the resolved default workspace on account routes and inherits archived / read-only rules from that workspace.
5. Add regression coverage for account pages rendering inside the shell, default-workspace resolution driving the shell on non-workspace routes, the account breadcrumb root behavior (including truncation rules), and the continued exclusion of step-up auth gates, `/account/closed`, `/dashboard`, authentication routes, and public share routes from the shared shell.

Rollback strategy:

- account pages can be moved back out of the shared shell if the hosted layout needs to be temporarily withdrawn; the non-workspace breadcrumb root and the default-workspace resolution added here are additive and can be left dormant.
- no server-side account-settings contract is changed in this change, so rolling back the UI hosting does not affect passkeys, two-factor, or close-account behavior.

## Open Questions

None open. The initiative's four-change split now fully covers the shared private workspace shell, the workspace overview and default landing, the workspace-scoped shell upload experience, and the account-pages relocation into the shell.
