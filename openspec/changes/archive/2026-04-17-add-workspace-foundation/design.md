## Context

The current OpenSpec set still assumes an owner-scoped product model in several transcript-facing areas. The workspace exploration concluded that this is not just an authorization layer change: the durable parent of transcript resources needs to move from `user` to `workspace` before transcript processing, management, sharing, and export are implemented too deeply.

This foundation change keeps the scope intentionally narrow:

- establish workspaces as first-class durable records
- establish membership roles, the shared `eligible active admin` notion, and the base admin invariant
- create a personal workspace automatically for every account
- make workspace the durable ownership boundary that later changes will build on

It deliberately avoids pulling in invitations, archival side effects, markdown edit locking, or account-closure rules.

## Goals / Non-Goals

**Goals:**

- Define the durable `workspace` model with `personal` and `team` types.
- Create one personal workspace automatically for every account.
- Define the membership-role model `read_only | member | admin`.
- Define the shared `eligible active admin` notion that later admin-preservation rules rely on.
- Define the invariant that an active workspace must always retain at least one eligible active admin.
- Make transcript-adjacent product resources workspace-owned while preserving creator attribution separately from workspace ownership, including when later account-lifecycle work removes the creator account.
- Establish the minimum workspace context contract that later authenticated product surfaces can rely on.

**Non-Goals:**

- Invitation issuance, resend, revocation, or acceptance flows.
- Workspace archival and restoration lifecycle rules.
- Transcript markdown edit locks or autosave behavior.
- V1 account closure or retention behavior.
- Mandatory workspace-picker flows or richer remembered-workspace UX beyond the default-entry rule and route/session contract.
- Transcript transfer between workspaces.

## Decisions

### Decision: Use one durable workspace entity with `personal` and `team` types

The product will use a first-class `workspace` record rather than treating collaboration as optional metadata on the user account. Each workspace has a type:

- `personal`
- `team`

This keeps the durable ownership boundary explicit for later transcript, sharing, export, and job-related data.

**Why this over alternatives**

- Over adding a nullable `workspaceId` to the user model: that would not support multi-workspace membership cleanly.
- Over only modeling team workspaces and keeping personal data directly on the user: that would split the product into two ownership models too early.

### Decision: Automatically create one personal workspace for every account

Every account gets exactly one personal workspace as part of account bootstrap. The personal workspace is the user's default durable home even if they later join team workspaces.

The personal workspace follows stricter policy than a normal team workspace:

- it is single-user in practice
- it cannot be left
- it cannot be deleted through the normal workspace lifecycle

**Why this over alternatives**

- Over creating personal workspaces lazily: later workspace-scoped features would have to handle a missing-home-workspace state.
- Over skipping a personal workspace entirely: account- and workspace-scoped data would diverge again.

### Decision: Represent access through memberships with explicit roles

Access to a workspace is mediated by `workspace_memberships` with one role per membership:

- `read_only`
- `member`
- `admin`

The personal workspace can still use the same general membership model for consistency, while product policy keeps it effectively single-user.

**Why this over alternatives**

- Over a single `isAdmin` flag: later collaboration rules already need more than two access levels.
- Over special-casing team-only memberships and giving personal workspaces no membership record: that would split authorization logic early.

### Decision: Define an eligible active admin from both role and account access state

A workspace membership counts as an eligible active admin only when:

- the membership role is `admin`
- the associated account is still active
- the associated account still has normal authenticated access

This shared notion is what later admin-preservation rules use. Raw admin memberships on closed or access-suspended accounts do not satisfy the invariant on their own.

**Why this over alternatives**

- Over counting every raw admin membership: a workspace could appear governed while no admin can actually act.
- Over letting each later change redefine admin eligibility independently: the same invariant would drift across membership, archive, and account-lifecycle flows.

### Decision: Make workspace the durable ownership boundary and preserve creator attribution separately

Transcript-adjacent product resources should be associated with a workspace for authorization and browsing, while still preserving who initiated or created the record.

For transcript resources, this means later changes should expect:

- `workspaceId` for durable ownership
- `createdByUserId` for attribution while the creating account still exists

Later account-lifecycle work may permanently delete the creating account without changing workspace ownership, so creator attribution must remain separate from the workspace boundary and tolerate a deleted creator account.

This keeps team data collaborative without losing author context.

**Why this over alternatives**

- Over keeping owner-scoped resources and layering workspace access on top: ownership and authorization would drift apart.
- Over storing only `workspaceId` and dropping creator attribution: product rules already distinguish between member-created and admin-managed actions.
- Over tying workspace-owned resource survival to the continued existence of the creating account: collaborative data would follow the wrong lifecycle boundary.

### Decision: An active workspace must always retain at least one eligible active admin

The workspace model adopts a strong invariant:

- active team workspaces cannot be left with zero eligible active admins

That invariant must be enforced server-side and transactionally for actions such as removing a member, downgrading an admin, leaving a workspace, and later account-closure flows that would make an admin ineligible.

**Why this over alternatives**

- Over relying on UI checks only: concurrent actions could still produce an admin-less workspace.
- Over allowing admin-less workspaces and repairing them later: later admin actions and archival flows would become ambiguous.
- Over treating suspended or closed admins as if they still satisfy the invariant: the workspace would still lack a currently reachable governing admin.

### Decision: Use the URL as the source of truth for workspace-scoped product surfaces

Later authenticated product surfaces should resolve a concrete workspace context rather than infer everything from hidden current-user owner state. For any workspace-scoped private route or API surface, the explicit workspace segment in the route is authoritative, for example `/w/[workspaceSlug]/...`.

The workspace context contract is:

- a workspace-scoped private route resolves the current workspace from the explicit route segment
- server-side membership and lifecycle checks validate that resolved workspace before product access is granted
- server session state may remember the last successfully used workspace only as a fallback for authenticated entry points that do not yet specify a workspace
- remembered preference is convenience state only and must never override an explicit workspace route

This keeps links, refreshes, back-forward navigation, and multi-tab usage deterministic while still leaving richer workspace-picker and remembered-workspace UX open.

**Why this over alternatives**

- Over hiding all workspace selection in implicit session state: multi-tab behavior, deep links, and route handling become brittle in a multi-workspace product.
- Over treating remembered preference as the source of truth: preference state can be stale, device-local, and not shareable through links.
- Over fully deciding the broader workspace-selection UX now: the conversation still leaves richer picker behavior and polish for later work.

### Decision: Use explicit destination, then last valid workspace, then personal workspace for authenticated entry

When an authenticated entry point does not already specify a workspace-scoped private destination, the system should still land the user deterministically without forcing a workspace picker in V1.

The default authenticated-entry order is:

1. preserve an explicit authorized destination such as `returnTo`
2. otherwise use the last successfully used workspace remembered on the server when it is still accessible and not archived
3. otherwise fall back to the user's personal workspace

This keeps post-sign-in entry lightweight while ensuring the fallback never lands the user in a stale or inaccessible workspace.

**Why this over alternatives**

- Over forcing a workspace picker after every sign-in: it adds friction to the common path without being required for V1 clarity.
- Over always landing in the personal workspace: it throws away recent multi-workspace context for returning users.
- Over blindly reusing the last remembered workspace: it can route users into archived or no-longer-accessible workspaces.

## Risks / Trade-offs

- [Changing the durable ownership boundary touches many downstream changes] -> Introduce the workspace foundation before transcript-focused implementation proceeds further and retarget owner-scoped changes afterward.
- [Personal workspaces introduce special-case rules] -> Reuse the same workspace and membership primitives where possible, and keep the policy exceptions explicit.
- [Role names can imply product permissions that later changes have not implemented yet] -> Treat the roles as the stable scaffolding and let each later capability define which actions each role unlocks.

## Migration Plan

1. Add durable workspace and membership tables plus the minimum shared helpers that resolve a user's workspace context from explicit route state, preserve explicit authenticated destinations, choose last valid workspace then personal workspace for unscoped private entry points, and compute eligible active-admin status.
2. Create one personal workspace for every account as part of account bootstrap.
3. If any pre-workspace data already exists by implementation time, backfill a personal workspace and membership for those users before turning on workspace-scoped product paths.
4. Update downstream transcript-focused changes to assume `workspaceId` ownership plus separate creator attribution, initially via `createdByUserId` while the account exists, instead of `ownerUserId`.

Rollback strategy:

- preserve personal workspaces and memberships in Postgres even if the app temporarily falls back to single-workspace behavior
- keep workspace resolution helpers narrow enough that later transcript changes can be feature-flagged off if needed

## Open Questions

- None.
