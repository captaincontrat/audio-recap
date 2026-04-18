import { describe, expect, test } from "vitest";

import { wouldViolateLastEligibleAdminInvariant } from "@/lib/server/workspaces/invariants";

type AdminRow = {
  membershipId: string;
  userId: string;
  role: "admin";
  userExists: boolean;
  closedAt: Date | null;
};

function admin(partial: Partial<AdminRow> & { membershipId: string }): AdminRow {
  return {
    userId: `u_${partial.membershipId}`,
    role: "admin",
    userExists: true,
    closedAt: null,
    ...partial,
  } as AdminRow;
}

describe("wouldViolateLastEligibleAdminInvariant", () => {
  test("removing the only eligible admin violates the invariant", () => {
    const admins = [admin({ membershipId: "m1" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m1",
      userExistsAfter: false,
    });
    expect(violates).toBe(true);
  });

  test("removing one of two eligible admins does not violate the invariant", () => {
    const admins = [admin({ membershipId: "m1" }), admin({ membershipId: "m2" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m1",
      userExistsAfter: false,
    });
    expect(violates).toBe(false);
  });

  test("ignores ineligible admins when checking the invariant", () => {
    const admins = [admin({ membershipId: "m1", userExists: false }), admin({ membershipId: "m2" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m2",
      userExistsAfter: false,
    });
    expect(violates).toBe(true);
  });

  test("downgrading the last admin to member counts as violating the invariant", () => {
    const admins = [admin({ membershipId: "m1" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m1",
      roleAfter: "member",
    });
    expect(violates).toBe(true);
  });

  test("downgrading one of multiple eligible admins leaves the invariant intact", () => {
    const admins = [admin({ membershipId: "m1" }), admin({ membershipId: "m2" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m1",
      roleAfter: "read_only",
    });
    expect(violates).toBe(false);
  });

  test("simulating the unchanged admin row still leaves the invariant satisfied", () => {
    const admins = [admin({ membershipId: "m1" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, { membershipId: "m1" });
    expect(violates).toBe(false);
  });

  test("disqualifying an admin not present in the list never violates the invariant", () => {
    const admins = [admin({ membershipId: "m1" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "other",
      userExistsAfter: false,
    });
    expect(violates).toBe(false);
  });

  test("closing the only eligible admin's account violates the invariant", () => {
    const admins = [admin({ membershipId: "m1" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m1",
      closedAtAfter: new Date("2026-04-10T00:00:00Z"),
    });
    expect(violates).toBe(true);
  });

  test("closing one of multiple eligible admins leaves the invariant intact", () => {
    const admins = [admin({ membershipId: "m1" }), admin({ membershipId: "m2" })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m1",
      closedAtAfter: new Date("2026-04-10T00:00:00Z"),
    });
    expect(violates).toBe(false);
  });

  test("an already-closed admin is not counted toward the invariant", () => {
    const admins = [admin({ membershipId: "m1" }), admin({ membershipId: "m2", closedAt: new Date("2026-04-01T00:00:00Z") })];
    const violates = wouldViolateLastEligibleAdminInvariant(admins, {
      membershipId: "m1",
      closedAtAfter: new Date("2026-04-10T00:00:00Z"),
    });
    expect(violates).toBe(true);
  });
});
