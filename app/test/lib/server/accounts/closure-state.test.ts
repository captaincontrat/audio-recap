import { describe, expect, test } from "vitest";

import {
  computeScheduledAccountDeleteAt,
  deriveAccountClosureState,
  isAccountActive,
  isAccountClosed,
  isPastReactivationWindow,
  isWithinReactivationWindow,
  REACTIVATION_WINDOW_DAYS,
} from "@/lib/server/accounts/closure-state";

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

describe("computeScheduledAccountDeleteAt", () => {
  test("returns closedAt + 30 days", () => {
    const closedAt = new Date("2026-04-01T00:00:00Z");
    expect(computeScheduledAccountDeleteAt(closedAt).toISOString()).toBe(new Date(closedAt.getTime() + REACTIVATION_WINDOW_DAYS * MS_PER_DAY).toISOString());
  });
});

describe("isAccountActive / isAccountClosed", () => {
  test("active account has closedAt null", () => {
    const row = { closedAt: null, scheduledDeleteAt: null };
    expect(isAccountActive(row)).toBe(true);
    expect(isAccountClosed(row)).toBe(false);
  });

  test("closed account has non-null closedAt", () => {
    const row = { closedAt: new Date("2026-04-01T00:00:00Z"), scheduledDeleteAt: new Date("2026-05-01T00:00:00Z") };
    expect(isAccountActive(row)).toBe(false);
    expect(isAccountClosed(row)).toBe(true);
  });
});

describe("isPastReactivationWindow", () => {
  const closedAt = new Date("2026-04-01T00:00:00Z");
  const scheduledDeleteAt = computeScheduledAccountDeleteAt(closedAt);

  test("returns false while the window is active", () => {
    const now = new Date(scheduledDeleteAt.getTime() - MS_PER_DAY);
    expect(isPastReactivationWindow({ closedAt, scheduledDeleteAt }, now)).toBe(false);
  });

  test("returns true once the scheduled-delete moment elapses", () => {
    const now = new Date(scheduledDeleteAt.getTime() + 1);
    expect(isPastReactivationWindow({ closedAt, scheduledDeleteAt }, now)).toBe(true);
  });

  test("returns false for active accounts regardless of now", () => {
    expect(isPastReactivationWindow({ closedAt: null, scheduledDeleteAt: null }, new Date("3000-01-01T00:00:00Z"))).toBe(false);
  });

  test("returns false when scheduledDeleteAt is missing even if closedAt is set", () => {
    expect(isPastReactivationWindow({ closedAt, scheduledDeleteAt: null }, new Date(closedAt.getTime() + 365 * MS_PER_DAY))).toBe(false);
  });
});

describe("isWithinReactivationWindow", () => {
  const closedAt = new Date("2026-04-01T00:00:00Z");
  const scheduledDeleteAt = computeScheduledAccountDeleteAt(closedAt);

  test("returns true before the window elapses", () => {
    expect(isWithinReactivationWindow({ closedAt, scheduledDeleteAt }, new Date(scheduledDeleteAt.getTime() - 1))).toBe(true);
  });

  test("returns false after the window elapses", () => {
    expect(isWithinReactivationWindow({ closedAt, scheduledDeleteAt }, new Date(scheduledDeleteAt.getTime() + 1))).toBe(false);
  });

  test("returns false for an active account", () => {
    expect(isWithinReactivationWindow({ closedAt: null, scheduledDeleteAt: null }, new Date())).toBe(false);
  });
});

describe("deriveAccountClosureState", () => {
  const closedAt = new Date("2026-04-01T00:00:00Z");
  const scheduledDeleteAt = computeScheduledAccountDeleteAt(closedAt);

  test("returns 'active' when closedAt is null", () => {
    expect(deriveAccountClosureState({ closedAt: null, scheduledDeleteAt: null }, new Date())).toBe("active");
  });

  test("returns 'closed_reactivable' within window", () => {
    expect(deriveAccountClosureState({ closedAt, scheduledDeleteAt }, new Date(closedAt.getTime() + MS_PER_DAY))).toBe("closed_reactivable");
  });

  test("returns 'closed_past_reactivation_window' after window", () => {
    expect(deriveAccountClosureState({ closedAt, scheduledDeleteAt }, new Date(scheduledDeleteAt.getTime() + MS_PER_DAY))).toBe(
      "closed_past_reactivation_window",
    );
  });
});
