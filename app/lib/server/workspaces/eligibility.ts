import type { WorkspaceRole } from "@/lib/server/db/schema";

// "Eligible active admin" is the shared notion that later admin-preservation
// rules rely on. See
// `openspec/changes/add-workspace-foundation/design.md#decision-define-an-eligible-active-admin-from-both-role-and-account-access-state`
// for the full definition. This module intentionally exports *pure* helpers
// so the rule has a single source of truth that can be unit-tested without
// touching the database; DB helpers compose these predicates with real rows.
//
// In this V1 schema the user record has no explicit suspended/closed fields
// yet. Later account-lifecycle capabilities (account closure, suspension)
// will narrow `AdminAccountAccessInput` by adding fields such as `closedAt`
// or `accessSuspendedAt`; updating the predicates in this module will then
// tighten every caller in lockstep.

export type AdminAccountAccessInput = {
  userExists: boolean;
};

export type EligibleAdminMembershipInput = {
  role: WorkspaceRole;
  account: AdminAccountAccessInput;
};

// Does the account attached to this membership retain normal authenticated
// access? Split out of the membership-level predicate so later changes can
// extend it without touching every call site.
export function hasNormalAuthenticatedAccess(account: AdminAccountAccessInput): boolean {
  return account.userExists;
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
