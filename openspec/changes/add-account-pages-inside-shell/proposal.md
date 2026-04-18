## Why

After `add-workspace-app-shell` and `add-shell-upload-entry-points-and-manager`, the shared private workspace shell hosts every workspace-scoped route and owns workspace-scoped upload chrome. Authenticated account-settings pages (`/account/security` and `/account/close`) still render with their old bare centered layouts though, which makes them feel detached from the rest of the signed-in product: once a user opens account settings, the sidebar workspace switcher, header upload control, drop overlay, upload manager, and workspace-rooted breadcrumb all vanish even though the user is still signed in and mid-session.

This change generalizes the shared shell to host `/account/security` and `/account/close` inside the same shell chrome used on workspace routes, using a default-workspace resolution for workspace-scoped shell features and a non-workspace breadcrumb root so the breadcrumb's workspace-rooted rule does not accidentally misrepresent account pages. Step-up auth gates (`/account/recent-auth`) and the post-closure landing (`/account/closed`) remain outside the shell, because they represent states where a workspace-chromed layout would misrepresent the user's session or identity.

## What Changes

- Extend the shared workspace shell to host authenticated account-settings pages `/account/security` and `/account/close`.
- For these non-workspace shell routes, resolve a current workspace context using the same default-workspace resolution used by the `/dashboard` redirect entry point (last successfully used accessible active workspace, otherwise the user's personal workspace). The sidebar workspace switcher, header upload control, drop overlay, and upload-manager rehydration all target that resolved workspace while the user is on an account page.
- Do not multiply account URLs across workspace slugs: account pages stay at `/account/security` and `/account/close` and are not moved under `w/[slug]/account/*`.
- Add a non-workspace breadcrumb root for account shell routes (for example `Account`) so the breadcrumb's workspace-rooted rule does not accidentally suggest that account settings belong to the resolved workspace. The truncation priority (final crumb shrinks first, middle crumbs collapse into an ellipsis dropdown) stays the same, and the account root crumb never shrinks.
- Keep step-up auth gates (`/account/recent-auth`) and the post-closure landing (`/account/closed`) outside the shared shell. All authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor) and public share routes also stay outside the shell.
- `/dashboard` remains an authenticated redirect entry point that does not render the shared shell itself; its job is still to resolve the default workspace and redirect to that workspace's overview route.

## Capabilities

### New Capabilities

- None. This change generalizes the existing `workspace-app-shell` capability to also host authenticated account-settings routes.

### Modified Capabilities

- `workspace-app-shell`: Extended to host authenticated `/account/security` and `/account/close` inside the shared shell using default-workspace context resolution for workspace-scoped shell features (sidebar workspace switcher, header upload control, drop overlay, upload-manager rehydration) and a non-workspace breadcrumb root for account routes.

## Impact

- `app/` moves `/account/security` and `/account/close` under the private route group that hosts the shared shell. They stop rendering their bare centered layouts and instead render inside `SidebarInset` below the shell header and the breadcrumb band.
- The shell's workspace resolution logic gains a non-workspace fallback: on workspace-scoped routes, workspace context continues to come from the explicit `[slug]` segment; on account-scoped shell routes, workspace context is resolved using the default-workspace resolution defined by `workspace-foundation` for authenticated entry without an explicit workspace destination. This resolution is shared with the logic used by the `/dashboard` redirect entry point.
- The breadcrumb band gets a non-workspace root variant that renders a content root such as `Account` for account shell routes. The existing truncation priority (final crumb shrinks first, then middle crumbs collapse into an ellipsis dropdown) applies unchanged. The root crumb never shrinks, whether it is the workspace root or the account root.
- Shell-level upload features continue to work unchanged on workspace routes. On account routes, they target the resolved default workspace. If the resolved default workspace is archived or the user has read-only access there, the existing archived and read-only shell rules apply and the shell does not accept queueable submissions.
- Step-up auth gates (`/account/recent-auth`), the post-closure landing (`/account/closed`), `/dashboard`, authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor), and public share routes remain outside the shared shell. The previous decisions that these surfaces must remain visually separate from the signed-in product shell are preserved.
- Account URLs are not multiplied across workspace slugs; they remain single canonical paths (`/account/security`, `/account/close`), so `security` does not feel like a per-workspace setting.
