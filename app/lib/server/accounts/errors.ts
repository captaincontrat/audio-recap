// Dedicated error classes for the account-closure retention capability.
// Callers can match on `instanceof` (route handlers) or on the `.code`
// literal (API response serialisers) to map the failure to the right HTTP
// or UI state. Error shapes mirror the conventions used by
// `lib/server/workspaces/errors.ts` so handlers can treat them uniformly.

import type { AccountClosureRefusalReason } from "./closure-eligibility";

// The closure subject account is unknown or has already been permanently
// deleted. Distinct from refusal errors so route handlers can branch on
// the "does this account exist" question without re-implementing it.
export class AccountNotFoundError extends Error {
  readonly code = "account_not_found" as const;
  constructor(message = "Account not found") {
    super(message);
    this.name = "AccountNotFoundError";
  }
}

// The closure eligibility check refused the action. `reason` carries the
// stable refusal identifier from `closure-eligibility.ts`; when the
// refusal is `last_eligible_admin_handoff_required`, `blockingWorkspaceIds`
// surfaces which workspaces still need a handoff so the UI can guide the
// user through them.
export class AccountClosureEligibilityError extends Error {
  readonly code = "account_closure_not_eligible" as const;
  readonly reason: AccountClosureRefusalReason;
  readonly blockingWorkspaceIds: ReadonlyArray<string>;
  constructor(reason: AccountClosureRefusalReason, options: { message?: string; blockingWorkspaceIds?: ReadonlyArray<string> } = {}) {
    super(options.message ?? defaultClosureEligibilityMessage(reason));
    this.name = "AccountClosureEligibilityError";
    this.reason = reason;
    this.blockingWorkspaceIds = options.blockingWorkspaceIds ?? [];
  }
}

function defaultClosureEligibilityMessage(reason: AccountClosureRefusalReason): string {
  switch (reason) {
    case "already_closed":
      return "This account is already closed";
    case "recent_auth_required":
      return "Recent authentication is required before closing your account";
    case "fresh_two_factor_required":
      return "Fresh second-factor verification is required before closing your account";
    case "last_eligible_admin_handoff_required":
      return "You must promote another member to admin before closing your account";
  }
}

// Reactivation was attempted but the account is not currently in the
// retained closed state (either still active, or already permanently
// deleted). Distinct from `AccountClosureEligibilityError` because the UX
// for "nothing to reactivate" and "step-up failed" differs.
export class AccountNotReactivatableError extends Error {
  readonly code = "account_not_reactivatable" as const;
  readonly reason: "not_closed" | "window_expired";
  constructor(reason: "not_closed" | "window_expired", message?: string) {
    super(message ?? defaultNotReactivatableMessage(reason));
    this.name = "AccountNotReactivatableError";
    this.reason = reason;
  }
}

function defaultNotReactivatableMessage(reason: "not_closed" | "window_expired"): string {
  switch (reason) {
    case "not_closed":
      return "This account is not in the closed reactivation state";
    case "window_expired":
      return "The 30-day reactivation window has elapsed";
  }
}

// Permanent deletion was called before the 30-day reactivation window
// elapsed. The sweep job and any explicit operator-triggered deletion
// both route through this guard so the spec's "only after the 30-day
// reactivation window elapses" language is enforced in one place.
export class AccountReactivationWindowActiveError extends Error {
  readonly code = "account_reactivation_window_active" as const;
  constructor(message = "Cannot permanently delete a closed account before the reactivation window elapses") {
    super(message);
    this.name = "AccountReactivationWindowActiveError";
  }
}
