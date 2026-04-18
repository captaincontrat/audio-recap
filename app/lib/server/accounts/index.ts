// Barrel re-exports for the account-closure retention capability. Later
// routes, API handlers, and UX layers import through this module so the
// capability can evolve the file layout without breaking downstream call
// sites.

export {
  type AccountClosureRefusalReason,
  type AccountClosureEligibilityInputs,
  type AccountClosureEligibilityOutcome,
  type ClosureAdminInvariantCheck,
  evaluateAccountClosureEligibility,
} from "./closure-eligibility";

export {
  type AccountClosureState,
  type AccountClosureTimestamps,
  computeScheduledAccountDeleteAt,
  deriveAccountClosureState,
  isAccountActive,
  isAccountClosed,
  isPastReactivationWindow,
  isWithinReactivationWindow,
  REACTIVATION_WINDOW_DAYS,
} from "./closure-state";

export {
  evaluateAdminHandoffForClosure,
  initiateAccountClosure,
  type InitiateAccountClosureArgs,
  permanentlyDeleteAccount,
  type PermanentlyDeleteAccountArgs,
  reactivateAccount,
  type ReactivateAccountArgs,
  sweepExpiredClosedAccounts,
} from "./closure";

export {
  AccountClosureEligibilityError,
  AccountNotFoundError,
  AccountNotReactivatableError,
  AccountReactivationWindowActiveError,
} from "./errors";

export { type CreatorAttributionInput, DELETED_USER_ATTRIBUTION_LABEL, renderCreatorAttribution } from "./attribution";

export { type CloseAccountActionResult, closeCurrentAccount } from "./close-action";

export { type ReactivateAccountActionResult, reactivateCurrentAccount } from "./reactivate-action";
