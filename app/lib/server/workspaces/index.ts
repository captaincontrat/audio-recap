// Barrel re-exports for the workspace foundation capability. Later product
// capabilities (transcript processing, invitations, archival, account
// lifecycle) import through this module so the foundation can evolve the
// file layout without breaking downstream call sites.

export {
  type AdminAccountAccessInput,
  countEligibleActiveAdmins as countEligibleActiveAdminsFromInputs,
  type EligibleAdminMembershipInput,
  hasNormalAuthenticatedAccess,
  isEligibleActiveAdmin,
} from "./eligibility";

export { LastEligibleAdminError, PersonalWorkspaceViolationError, WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "./errors";

export { assertCanLeaveOrDeletePersonalWorkspace, assertCanModifyAdminMembership } from "./invariant-guards";

export { type AdminAccountRow, wouldViolateLastEligibleAdminInvariant } from "./invariants";

export {
  type ExplicitDestination,
  type LandingDecision,
  type LandingInputs,
  type PersonalWorkspaceRef,
  type RememberedWorkspace,
  resolveDefaultLanding,
} from "./landing";

export {
  countEligibleActiveAdmins,
  describeAdminMemberships,
  findWorkspacesByIds,
  getMembershipRole,
  listAccessibleWorkspacesForUser,
  type MembershipContext,
  touchMembershipAccess,
} from "./memberships";

export { backfillPersonalWorkspaces, type EnsurePersonalWorkspaceOptions, ensurePersonalWorkspace } from "./personal";

export { type ResolvedWorkspaceContext, resolveDefaultLandingForUser, resolveWorkspaceContextFromSlug } from "./resolver";

export { type WorkspaceScopedResource, workspaceOwnershipColumns } from "./resource-contract";

export { generatePersonalWorkspaceSlug, isPersonalWorkspaceSlug } from "./slug";
