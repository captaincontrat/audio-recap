## 1. Data Model

- [x] 1.1 Add workspace and membership tables plus the workspace type and role enums.
- [x] 1.2 Create one personal workspace automatically for each account and define a backfill path for any pre-workspace accounts.

## 2. Workspace Context and Authorization

- [x] 2.1 Implement shared workspace-resolution helpers so explicit workspace-scoped routes are authoritative, while authenticated entry points without a workspace use explicit destination first, then last valid workspace, then personal workspace.
- [x] 2.2 Enforce the personal-workspace restrictions and the eligible-active-admin invariant at the foundation layer.

## 3. Downstream Integration Prep

- [x] 3.1 Add the `workspaceId` plus separate creator-attribution contract to transcript-adjacent resource models and interfaces, using `createdByUserId` while the creator account exists and allowing later account-lifecycle work to clear that reference without changing workspace ownership.
- [x] 3.2 Add automated coverage for personal workspace creation, membership role resolution, explicit-route precedence, deterministic default workspace landing, eligible-active-admin counting, and last-eligible-active-admin invariant checks.
