import type { WorkspaceRole } from "@/lib/server/db/schema";
import { isEligibleActiveAdmin } from "./eligibility";

// Shape shared by invariant simulations. Consumers fetch admin membership
// rows from the DB, map them to this shape, and then simulate hypothetical
// future states with the pure helper below.
export type AdminAccountRow = {
  membershipId: string;
  userId: string;
  role: WorkspaceRole;
  userExists: boolean;
};

// Given a set of admin memberships and a hypothetical future change
// (remove/disqualify a specific admin, role downgrade, account removal),
// check whether the invariant would still hold. Pure logic so callers can
// run the simulation before committing any DB write.
export function wouldViolateLastEligibleAdminInvariant(
  admins: readonly AdminAccountRow[],
  disqualified: { membershipId: string; userExistsAfter?: boolean; roleAfter?: WorkspaceRole },
): boolean {
  let eligibleRemaining = 0;
  for (const admin of admins) {
    if (admin.membershipId === disqualified.membershipId) {
      const roleAfter = disqualified.roleAfter ?? admin.role;
      const userExistsAfter = disqualified.userExistsAfter ?? admin.userExists;
      if (isEligibleActiveAdmin({ role: roleAfter, account: { userExists: userExistsAfter } })) {
        eligibleRemaining += 1;
      }
      continue;
    }
    if (isEligibleActiveAdmin({ role: admin.role, account: { userExists: admin.userExists } })) {
      eligibleRemaining += 1;
    }
  }
  return eligibleRemaining === 0;
}
