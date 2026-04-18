## 1. Non-workspace shell context

- [ ] 1.1 Add default-workspace context resolution for non-workspace shell routes that reuses the logic used by the `/dashboard` redirect entry point (last successfully used accessible active workspace, otherwise the user's personal workspace). Expose that context to the shell's providers alongside the existing workspace-route context.
- [ ] 1.2 Ensure the sidebar workspace switcher, the header upload control, the drop overlay, and the upload-manager rehydration all target the resolved default workspace while the user is on an account shell route.
- [ ] 1.3 Ensure the resolved default workspace's archived / read-only state propagates to the shell's upload chrome using the same rules introduced by `add-shell-upload-entry-points-and-manager` for workspace routes.

## 2. Non-workspace breadcrumb root

- [ ] 2.1 Extend the shell's breadcrumb band to support a non-workspace content root (for example `Account`) for account shell routes. The root label is localized and never shrinks.
- [ ] 2.2 Keep the truncation priority unchanged: the final (page-title) crumb truncates first with a full-title tooltip, middle crumbs collapse into an ellipsis dropdown when the chain still overflows, and the root crumb never shrinks.
- [ ] 2.3 Do not add account pages as sidebar destinations. The sidebar middle nav MUST continue to show Overview and Transcripts for the resolved workspace only.

## 3. Move account pages into the shared shell

- [ ] 3.1 Move `/account/security/page.tsx` and `/account/close/page.tsx` under the private route group that hosts the shared shell so they render inside `SidebarInset` below the shell header and the breadcrumb band. Remove their local bare centered layouts.
- [ ] 3.2 Keep `/account/recent-auth/page.tsx` and `/account/closed/page.tsx` outside the shared shell. The step-up auth gate and the post-closure landing continue to use their current focused layouts.
- [ ] 3.3 Keep `/dashboard/page.tsx` as an authenticated redirect entry point; it does not render the shared shell around itself.
- [ ] 3.4 Keep authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor) and public share routes outside the shared shell.

## 4. Regression coverage

- [ ] 4.1 Add coverage that `/account/security` and `/account/close` render inside the shared shell with a current-workspace context resolved from the default-workspace logic, and that the sidebar workspace switcher, header upload control, drop overlay, and upload-manager rehydration all target that resolved workspace.
- [ ] 4.2 Add coverage that the breadcrumb band on `/account/security` and `/account/close` begins with the non-workspace content root (for example `Account`), that the truncation priority is preserved (final crumb shrinks first, middle crumbs collapse into an ellipsis dropdown), and that the root crumb never shrinks.
- [ ] 4.3 Add coverage that `/account/recent-auth`, `/account/closed`, `/dashboard`, authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor), and public share routes remain outside the shared shell after this change.
- [ ] 4.4 Add coverage that upload chrome on account routes inherits archived / read-only rules from the resolved default workspace: archived or read-only resolved workspace MUST NOT show an accepting drop target or an active header upload control on account routes.
