import { describe, expect, test } from "vitest";

import {
  AccountClosureEligibilityError,
  AccountNotFoundError,
  AccountNotReactivatableError,
  AccountReactivationWindowActiveError,
} from "@/lib/server/accounts/errors";

describe("AccountClosureEligibilityError", () => {
  test("carries the refusal reason and an empty workspace list by default", () => {
    const error = new AccountClosureEligibilityError("already_closed");
    expect(error.code).toBe("account_closure_not_eligible");
    expect(error.reason).toBe("already_closed");
    expect(error.blockingWorkspaceIds).toEqual([]);
    expect(error.message).toBe("This account is already closed");
  });

  test("preserves blocking workspace ids passed in the constructor", () => {
    const error = new AccountClosureEligibilityError("last_eligible_admin_handoff_required", { blockingWorkspaceIds: ["ws_1", "ws_2"] });
    expect(error.reason).toBe("last_eligible_admin_handoff_required");
    expect(error.blockingWorkspaceIds).toEqual(["ws_1", "ws_2"]);
    expect(error.message).toMatch(/promote/i);
  });

  test("uses the recent-auth default message when the caller does not supply one", () => {
    const error = new AccountClosureEligibilityError("recent_auth_required");
    expect(error.message).toMatch(/recent authentication/i);
  });

  test("uses the fresh-2FA default message when the caller does not supply one", () => {
    const error = new AccountClosureEligibilityError("fresh_two_factor_required");
    expect(error.message).toMatch(/second-factor/i);
  });

  test("lets callers override the default message", () => {
    const error = new AccountClosureEligibilityError("already_closed", { message: "custom" });
    expect(error.message).toBe("custom");
  });
});

describe("AccountNotFoundError", () => {
  test("has a stable code and default message", () => {
    const error = new AccountNotFoundError();
    expect(error.code).toBe("account_not_found");
    expect(error.message).toBe("Account not found");
  });

  test("accepts a custom message", () => {
    const error = new AccountNotFoundError("nope");
    expect(error.message).toBe("nope");
  });
});

describe("AccountNotReactivatableError", () => {
  test("exposes the refusal reason and not_closed default message", () => {
    const error = new AccountNotReactivatableError("not_closed");
    expect(error.reason).toBe("not_closed");
    expect(error.message).toMatch(/not in the closed/i);
  });

  test("uses the window-expired default message when the caller does not supply one", () => {
    const error = new AccountNotReactivatableError("window_expired");
    expect(error.reason).toBe("window_expired");
    expect(error.message).toMatch(/30-day reactivation window/i);
  });

  test("lets callers override the default message", () => {
    const error = new AccountNotReactivatableError("not_closed", "custom");
    expect(error.message).toBe("custom");
  });
});

describe("AccountReactivationWindowActiveError", () => {
  test("has a stable code and default message", () => {
    const error = new AccountReactivationWindowActiveError();
    expect(error.code).toBe("account_reactivation_window_active");
    expect(error.message).toMatch(/reactivation window/i);
  });

  test("accepts a custom message", () => {
    const error = new AccountReactivationWindowActiveError("custom");
    expect(error.message).toBe("custom");
  });
});
