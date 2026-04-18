import { describe, expect, test } from "vitest";

import { evaluateAccountClosureEligibility } from "@/lib/server/accounts/closure-eligibility";

const BASE = {
  alreadyClosed: false,
  hasRecentAuth: true,
  twoFactorEnabled: false,
  freshSecondFactor: false,
  adminInvariantChecks: [] as ReadonlyArray<{ workspaceId: string; lastEligibleActiveAdmin: boolean }>,
} as const;

describe("evaluateAccountClosureEligibility", () => {
  test("allows closure when every gate is satisfied", () => {
    expect(evaluateAccountClosureEligibility({ ...BASE })).toEqual({ kind: "eligible" });
  });

  test("refuses when the account is already closed", () => {
    expect(evaluateAccountClosureEligibility({ ...BASE, alreadyClosed: true })).toEqual({ kind: "refused", reason: "already_closed" });
  });

  test("refuses when recent-auth is missing", () => {
    expect(evaluateAccountClosureEligibility({ ...BASE, hasRecentAuth: false })).toEqual({ kind: "refused", reason: "recent_auth_required" });
  });

  test("refuses when 2FA is enabled and fresh-2FA is missing", () => {
    expect(evaluateAccountClosureEligibility({ ...BASE, twoFactorEnabled: true, freshSecondFactor: false })).toEqual({
      kind: "refused",
      reason: "fresh_two_factor_required",
    });
  });

  test("allows closure when 2FA is not enabled regardless of fresh-2FA input", () => {
    expect(evaluateAccountClosureEligibility({ ...BASE, twoFactorEnabled: false, freshSecondFactor: false })).toEqual({ kind: "eligible" });
  });

  test("refuses when the user is the last eligible admin of any workspace", () => {
    expect(
      evaluateAccountClosureEligibility({
        ...BASE,
        adminInvariantChecks: [
          { workspaceId: "ws_alpha", lastEligibleActiveAdmin: false },
          { workspaceId: "ws_beta", lastEligibleActiveAdmin: true },
          { workspaceId: "ws_gamma", lastEligibleActiveAdmin: true },
        ],
      }),
    ).toEqual({
      kind: "refused",
      reason: "last_eligible_admin_handoff_required",
      blockingWorkspaceIds: ["ws_beta", "ws_gamma"],
    });
  });

  test("already_closed takes precedence over every other refusal reason", () => {
    expect(
      evaluateAccountClosureEligibility({
        alreadyClosed: true,
        hasRecentAuth: false,
        twoFactorEnabled: true,
        freshSecondFactor: false,
        adminInvariantChecks: [{ workspaceId: "ws", lastEligibleActiveAdmin: true }],
      }),
    ).toEqual({ kind: "refused", reason: "already_closed" });
  });

  test("recent-auth takes precedence over fresh-2FA and admin handoff", () => {
    expect(
      evaluateAccountClosureEligibility({
        alreadyClosed: false,
        hasRecentAuth: false,
        twoFactorEnabled: true,
        freshSecondFactor: false,
        adminInvariantChecks: [{ workspaceId: "ws", lastEligibleActiveAdmin: true }],
      }),
    ).toEqual({ kind: "refused", reason: "recent_auth_required" });
  });

  test("fresh-2FA takes precedence over admin handoff", () => {
    expect(
      evaluateAccountClosureEligibility({
        alreadyClosed: false,
        hasRecentAuth: true,
        twoFactorEnabled: true,
        freshSecondFactor: false,
        adminInvariantChecks: [{ workspaceId: "ws", lastEligibleActiveAdmin: true }],
      }),
    ).toEqual({ kind: "refused", reason: "fresh_two_factor_required" });
  });
});
