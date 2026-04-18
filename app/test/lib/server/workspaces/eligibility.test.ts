import { describe, expect, test } from "vitest";

import { countEligibleActiveAdmins, hasNormalAuthenticatedAccess, isEligibleActiveAdmin } from "@/lib/server/workspaces/eligibility";

describe("hasNormalAuthenticatedAccess", () => {
  test("returns true when the user account still exists", () => {
    expect(hasNormalAuthenticatedAccess({ userExists: true })).toBe(true);
  });

  test("returns false when the user account has been removed", () => {
    expect(hasNormalAuthenticatedAccess({ userExists: false })).toBe(false);
  });

  test("returns false when the account is in the closed retention state", () => {
    expect(hasNormalAuthenticatedAccess({ userExists: true, closedAt: new Date("2026-04-01T00:00:00Z") })).toBe(false);
  });

  test("treats explicit null closedAt as still active", () => {
    expect(hasNormalAuthenticatedAccess({ userExists: true, closedAt: null })).toBe(true);
  });
});

describe("isEligibleActiveAdmin", () => {
  test("only admin memberships with an active account count", () => {
    expect(isEligibleActiveAdmin({ role: "admin", account: { userExists: true } })).toBe(true);
  });

  test("admin memberships on missing accounts do not count", () => {
    expect(isEligibleActiveAdmin({ role: "admin", account: { userExists: false } })).toBe(false);
  });

  test("admin memberships on closed accounts do not count while the row still exists", () => {
    expect(isEligibleActiveAdmin({ role: "admin", account: { userExists: true, closedAt: new Date("2026-04-01T00:00:00Z") } })).toBe(false);
  });

  test("member memberships never count regardless of account state", () => {
    expect(isEligibleActiveAdmin({ role: "member", account: { userExists: true } })).toBe(false);
  });

  test("read-only memberships never count regardless of account state", () => {
    expect(isEligibleActiveAdmin({ role: "read_only", account: { userExists: true } })).toBe(false);
  });
});

describe("countEligibleActiveAdmins", () => {
  test("returns zero when there are no memberships", () => {
    expect(countEligibleActiveAdmins([])).toBe(0);
  });

  test("counts only active admins and ignores non-admin roles", () => {
    const count = countEligibleActiveAdmins([
      { role: "admin", account: { userExists: true } },
      { role: "member", account: { userExists: true } },
      { role: "admin", account: { userExists: false } },
      { role: "admin", account: { userExists: true } },
      { role: "read_only", account: { userExists: true } },
    ]);
    expect(count).toBe(2);
  });

  test("returns zero when every admin membership points to a removed account", () => {
    const count = countEligibleActiveAdmins([
      { role: "admin", account: { userExists: false } },
      { role: "admin", account: { userExists: false } },
    ]);
    expect(count).toBe(0);
  });
});
