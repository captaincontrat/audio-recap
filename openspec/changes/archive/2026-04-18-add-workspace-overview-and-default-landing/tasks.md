## 1. Workspace overview page

- [x] 1.1 Add a server-side overview composition that runs the existing workspace-scoped transcript reads twice and returns two projections: an active-work group (transcripts whose processing has not reached a terminal successful state, including queued, preprocessing, transcribing, generating_recap, generating_title, finalizing, and retrying, plus terminal failed transcripts) and a library-highlights group (recently updated transcripts the user can read).
- [x] 1.2 Build `w/[slug]/page.tsx` as a server component that renders the active-work group (with failed items marked as attention-worthy), the library-highlights group, an empty state when the workspace has no visible transcript records for the current user, a link into the full transcript library, and a start-upload CTA visible only to users with transcript-creation access in the current workspace that navigates to `w/[slug]/meetings/new`.
- [x] 1.3 Apply the private-workspace access model to the overview: inaccessible workspaces MUST use the same not-found behavior as other private workspace-scoped routes, archived workspaces MUST use the archived-workspace behavior used by other private workspace-scoped routes, and read-only members MUST see the activity groups without the create-work CTA.
- [x] 1.4 Keep the overview's page shell consistent with the existing workspace routes in this change (for example the current centered `main` layout used by `w/[slug]/transcripts`). Do not introduce a shared sidebar, header, or breadcrumb band; that is the next change.

## 2. Authenticated default landing

- [x] 2.1 Convert `/dashboard/page.tsx` into an authenticated redirect: preserve the existing unauthenticated / unverified / closed redirect behavior, then resolve the default workspace using the existing server-validated default-workspace logic and redirect to that workspace's overview route.
- [x] 2.2 Ensure explicit post-authentication destinations (for example `returnTo` targeting a workspace-scoped private route) still win over the default-landing resolution used by `/dashboard`.
- [x] 2.3 Update in-app links that currently target `/dashboard` as a product destination so they either resolve into the current workspace overview route when workspace context is available, or continue to route through `/dashboard` only as a default-landing entry point.

## 3. Regression coverage

- [x] 3.1 Add routing tests for authenticated default landing: `/dashboard` with no explicit destination redirects into the resolved workspace overview, explicit `returnTo` is preserved, archived or inaccessible workspaces are never selected as the default.
- [x] 3.2 Add tests for the overview page: active-work group unions non-terminal and terminal-failed transcripts, library-highlights group lists recently updated transcripts, failed items are surfaced as attention-worthy, empty-state renders when the workspace has no visible transcripts, and read-only members see the overview without the create-work CTA.
- [x] 3.3 Add tests for overview access behavior: inaccessible workspaces use the private-workspace not-found behavior, archived workspaces use the archived-workspace behavior, and the start-upload CTA is gated on transcript-creation access.
