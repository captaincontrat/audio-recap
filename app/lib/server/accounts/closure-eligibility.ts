// Pure account-closure eligibility check shared between the closure
// action, the orchestration service that performs the DB write, and the
// UI pre-checks. Kept pure so every refusal rule is covered by unit tests
// without touching the database or any external queue.
//
// The inputs describe the four step-up / invariant signals the design
// requires before V1 closure can proceed:
//   1. recent authentication for this closure attempt
//   2. fresh second-factor verification when the account has 2FA enabled
//   3. no workspace where the user is the last eligible active admin
//   4. the account is not already in the closed retention state
//
// Downstream callers are expected to compute those booleans themselves
// (e.g. by running `verifyRecentAuth`, inspecting the 2FA verification
// cookie, and simulating the admin invariant per workspace) and hand
// them in here so the rule has a single source of truth.

export type AccountClosureRefusalReason = "already_closed" | "recent_auth_required" | "fresh_two_factor_required" | "last_eligible_admin_handoff_required";

// Per-workspace admin-invariant summary. `workspaceId` is included so UI
// copy and audit logs can surface which workspace still needs a handoff
// when `lastEligibleActiveAdmin` is true.
export type ClosureAdminInvariantCheck = {
  workspaceId: string;
  lastEligibleActiveAdmin: boolean;
};

export type AccountClosureEligibilityInputs = {
  // Is the account already in the retained closed state? When true, the
  // UI should be routing the user to reactivation or expiry messaging
  // rather than offering closure again.
  alreadyClosed: boolean;
  // Has the current session completed recent authentication for this
  // closure attempt? See `lib/auth/recent-auth.ts`.
  hasRecentAuth: boolean;
  // Does the account have 2FA enabled? If false, `freshSecondFactor` is
  // ignored; if true, the user must also complete a fresh second-factor
  // verification for this closure attempt.
  twoFactorEnabled: boolean;
  // Has the user completed a fresh second-factor verification for this
  // closure attempt? Ignored when `twoFactorEnabled` is false.
  freshSecondFactor: boolean;
  // Result of simulating last-eligible-active-admin invariants for every
  // non-personal workspace the user admins. Any entry with
  // `lastEligibleActiveAdmin: true` blocks closure until the user hands
  // off admin responsibility in that workspace.
  adminInvariantChecks: ReadonlyArray<ClosureAdminInvariantCheck>;
};

export type AccountClosureEligibilityOutcome =
  | { kind: "eligible" }
  | { kind: "refused"; reason: AccountClosureRefusalReason; blockingWorkspaceIds?: ReadonlyArray<string> };

// Evaluate closure eligibility. Refusal ordering is deterministic so
// tests and UI both observe the same precedence:
//   1. accounts already in the closed retention state short-circuit so the
//      UI can route to reactivation/expiry messaging instead of offering
//      closure again;
//   2. recent-auth is checked before the 2FA prompt so users see the
//      primary-auth prompt first;
//   3. fresh second-factor verification is required only when the account
//      has 2FA enabled;
//   4. last-eligible-active-admin handoff is the final gate — the user
//      can only reach it after proving identity, which matches the UX
//      flow.
export function evaluateAccountClosureEligibility(inputs: AccountClosureEligibilityInputs): AccountClosureEligibilityOutcome {
  if (inputs.alreadyClosed) {
    return { kind: "refused", reason: "already_closed" };
  }
  if (!inputs.hasRecentAuth) {
    return { kind: "refused", reason: "recent_auth_required" };
  }
  if (inputs.twoFactorEnabled && !inputs.freshSecondFactor) {
    return { kind: "refused", reason: "fresh_two_factor_required" };
  }
  const blocking = inputs.adminInvariantChecks.filter((check) => check.lastEligibleActiveAdmin).map((check) => check.workspaceId);
  if (blocking.length > 0) {
    return { kind: "refused", reason: "last_eligible_admin_handoff_required", blockingWorkspaceIds: blocking };
  }
  return { kind: "eligible" };
}
