import type { WorkspaceRole } from "@/lib/server/db/schema";
import { isEligibleActiveAdmin } from "./eligibility";

// Shape shared by invariant simulations. Consumers fetch admin membership
// rows from the DB, map them to this shape, and then simulate hypothetical
// future states with the pure helper below. `closedAt` mirrors the
// `user.closed_at` column added by `add-account-closure-retention`; a
// non-null value suspends normal authenticated access while the row is
// retained inside the reactivation window.
export type AdminAccountRow = {
  membershipId: string;
  userId: string;
  role: WorkspaceRole;
  userExists: boolean;
  closedAt: Date | null;
};

// Given a set of admin memberships and a hypothetical future change
// (remove/disqualify a specific admin, role downgrade, account removal,
// account closure), check whether the invariant would still hold. Pure
// logic so callers can run the simulation before committing any DB write.
export function wouldViolateLastEligibleAdminInvariant(
  admins: readonly AdminAccountRow[],
  disqualified: { membershipId: string; userExistsAfter?: boolean; roleAfter?: WorkspaceRole; closedAtAfter?: Date | null },
): boolean {
  let eligibleRemaining = 0;
  for (const admin of admins) {
    if (admin.membershipId === disqualified.membershipId) {
      const roleAfter = disqualified.roleAfter ?? admin.role;
      const userExistsAfter = disqualified.userExistsAfter ?? admin.userExists;
      const closedAtAfter = disqualified.closedAtAfter === undefined ? admin.closedAt : disqualified.closedAtAfter;
      if (isEligibleActiveAdmin({ role: roleAfter, account: { userExists: userExistsAfter, closedAt: closedAtAfter } })) {
        eligibleRemaining += 1;
      }
      continue;
    }
    if (isEligibleActiveAdmin({ role: admin.role, account: { userExists: admin.userExists, closedAt: admin.closedAt } })) {
      eligibleRemaining += 1;
    }
  }
  return eligibleRemaining === 0;
}
