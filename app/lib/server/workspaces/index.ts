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
  InvalidInvitationError,
  InvitationEmailMismatchError,
  InvitationTargetAlreadyMemberError,
  LastEligibleAdminError,
  PersonalWorkspaceViolationError,
  WorkspaceAccessDeniedError,
  WorkspaceArchivedError,
  WorkspaceNotFoundError,
} from "./errors";

export { assertCanLeaveOrDeletePersonalWorkspace, assertCanModifyAdminMembership } from "./invariant-guards";

export { type AdminAccountRow, wouldViolateLastEligibleAdminInvariant } from "./invariants";

export {
  type AddMembershipArgs,
  addWorkspaceMembership,
  type ChangeMembershipRoleArgs,
  changeWorkspaceMembershipRole,
  MembershipRoleUnchangedError,
  type RemoveMembershipArgs,
  removeWorkspaceMembership,
} from "./membership-admin";

export {
  type AddMembershipInputs,
  type CallerContext,
  type ChangeRoleInputs,
  evaluateAddMembership,
  evaluateAdminPreconditions,
  evaluateChangeRole,
  evaluateRemoveMembership,
  type MembershipMutationKind,
  type MembershipMutationOutcome,
  type MembershipMutationRefusalReason,
  type RemoveMembershipInputs,
  type WorkspaceShape,
} from "./membership-decisions";

export {
  type AcceptInvitationArgs,
  type AcceptInvitationResult,
  acceptWorkspaceInvitation,
  expirePendingInvitations,
  findPendingInvitationByToken,
  invalidateWorkspaceInvitationsOnArchive,
  type IssueInvitationArgs,
  type IssueInvitationResult,
  issueWorkspaceInvitation,
  listWorkspaceInvitations,
  MembershipAlreadyExistsError,
  type ResendInvitationArgs,
  resendWorkspaceInvitation,
  type RevokeInvitationArgs,
  revokeWorkspaceInvitation,
} from "./invitations";

export {
  INVITATION_ARCHIVE_EFFECT_ID,
  invitationArchiveSideEffect,
  registerInvitationArchiveSideEffect,
  unregisterInvitationArchiveSideEffect,
} from "./invitation-archive-effect";

export { registerWorkspaceArchiveSideEffects } from "./bootstrap";

export {
  type AcceptInvitationInputs,
  classifyInvitationValidity,
  computeInvitationExpiry,
  evaluateAcceptInvitation,
  evaluateInvitationAdminPreconditions,
  evaluateIssueInvitation,
  type GenericInvalidInvitationReason,
  INVITATION_TTL_MS,
  type InvitationAcceptanceOutcome,
  type InvitationAcceptanceRefusalReason,
  type InvitationIssueRefusalReason,
  type InvitationMutationOutcome,
  type InvitationRowShape,
  type IssueInvitationInputs,
} from "./invitation-decisions";

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
