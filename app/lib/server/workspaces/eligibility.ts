import type { WorkspaceRole } from "@/lib/server/db/schema";

// "Eligible active admin" is the shared notion that later admin-preservation
// rules rely on. See
// `openspec/changes/add-workspace-foundation/design.md#decision-define-an-eligible-active-admin-from-both-role-and-account-access-state`
// for the full definition. This module intentionally exports *pure* helpers
// so the rule has a single source of truth that can be unit-tested without
// touching the database; DB helpers compose these predicates with real rows.
//
// `closedAt` was introduced by `add-account-closure-retention`: a closed
// account is retained in the database during its 30-day reactivation
// window but has its normal authenticated access suspended, so it MUST
// NOT satisfy the admin invariant. Permanent deletion later removes the
// `user` row, at which point `userExists` flips to `false` and the
// predicate refuses the membership for a second reason.

export type AdminAccountAccessInput = {
  userExists: boolean;
  // Populated from `user.closedAt` when the caller has access to the
  // user row. `null` (or omitted, for non-closure-aware call sites)
  // means the account has not entered the closure retention state.
  closedAt?: Date | null;
};

export type EligibleAdminMembershipInput = {
  role: WorkspaceRole;
  account: AdminAccountAccessInput;
};

// Does the account attached to this membership retain normal authenticated
// access? The closure retention capability suspends normal access the
// moment `closedAt` is stamped (before permanent deletion removes the row
// entirely), so a non-null `closedAt` disqualifies the account even while
// the underlying row still exists.
export function hasNormalAuthenticatedAccess(account: AdminAccountAccessInput): boolean {
  if (!account.userExists) return false;
  if (account.closedAt !== null && account.closedAt !== undefined) return false;
  return true;
}

// Is this admin membership counted as an eligible active admin? The
// definition matches the spec word-for-word: role must be `admin` AND the
// associated account must still be active AND retain normal authenticated
// access.
export function isEligibleActiveAdmin(input: EligibleAdminMembershipInput): boolean {
  if (input.role !== "admin") {
    return false;
  }
  return hasNormalAuthenticatedAccess(input.account);
}

// Count eligible active admins across a list of admin memberships. Used by
// invariant helpers; kept pure so its behavior is trivially testable.
export function countEligibleActiveAdmins(memberships: readonly EligibleAdminMembershipInput[]): number {
  let count = 0;
  for (const membership of memberships) {
    if (isEligibleActiveAdmin(membership)) {
      count += 1;
    }
  }
  return count;
}
