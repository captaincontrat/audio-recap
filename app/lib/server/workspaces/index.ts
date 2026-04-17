// Barrel re-exports for the workspace foundation capability. Later product
// capabilities (transcript processing, invitations, archival, account
// lifecycle) import through this module so the foundation can evolve the
// file layout without breaking downstream call sites.

export {
  type ArchiveWorkspaceArgs,
  archiveWorkspace,
  type PermanentlyDeleteWorkspaceArgs,
  permanentlyDeleteWorkspace,
  type RestoreWorkspaceArgs,
  restoreWorkspace,
  sweepExpiredArchivedWorkspaces,
} from "./archival";
export {
  type ArchivalEligibilityInputs,
  type ArchivalEligibilityOutcome,
  evaluateArchivalEligibility,
} from "./archival-eligibility";
export {
  assertAutosaveAllowed,
  assertInvitationAcceptanceAllowed,
  assertPublicShareResolvable,
  assertTranscriptExportAllowed,
  assertTranscriptLibraryAccessible,
  canResumeEditSession,
} from "./archival-gates";
export {
  ArchivalSideEffectError,
  type ArchiveSideEffect,
  type ArchiveSideEffectContext,
  listRegisteredArchiveSideEffects,
  registerArchiveSideEffect,
  runArchiveSideEffects,
  unregisterArchiveSideEffect,
} from "./archival-side-effects";
export {
  computeScheduledDeleteAt,
  deriveArchivalState,
  isPastRestorationWindow,
  isShareSuppressedByRestore,
  isWorkspaceActive,
  isWorkspaceArchived,
  RESTORATION_WINDOW_DAYS,
  type WorkspaceArchivalState,
  type WorkspaceArchivalTimestamps,
} from "./archival-state";
export {
  type AdminAccountAccessInput,
  countEligibleActiveAdmins as countEligibleActiveAdminsFromInputs,
  type EligibleAdminMembershipInput,
  hasNormalAuthenticatedAccess,
  isEligibleActiveAdmin,
} from "./eligibility";
export {
  ArchivalEligibilityError,
  type ArchivalEligibilityRefusalReason,
  LastEligibleAdminError,
  PersonalWorkspaceViolationError,
  WorkspaceAccessDeniedError,
  WorkspaceArchivedError,
  WorkspaceNotFoundError,
} from "./errors";

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
