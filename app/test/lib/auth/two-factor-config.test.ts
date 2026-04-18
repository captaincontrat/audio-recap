import { describe, expect, test } from "vitest";

import {
  RECENT_AUTH_MAX_AGE_SECONDS,
  TRUST_DEVICE_MAX_AGE_SECONDS,
  TWO_FACTOR_COOKIE_MAX_AGE_SECONDS,
  TWO_FACTOR_OTP_DIGITS,
  TWO_FACTOR_OTP_PERIOD_MINUTES,
} from "@/lib/auth/two-factor-config";

// Guard the security-sensitive windows: every constant has a narrow
// intent and an accidental bump (e.g. 30 days → 30 weeks) silently
// widens the risk surface. These are value-sanity assertions, not
// behavioral tests.
describe("two-factor-config", () => {
  test("two-factor challenge cookie lasts ten minutes", () => {
    expect(TWO_FACTOR_COOKIE_MAX_AGE_SECONDS).toBe(600);
  });

  test("trusted-device cookie lasts thirty days", () => {
    expect(TRUST_DEVICE_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  test("OTP period is three minutes", () => {
    expect(TWO_FACTOR_OTP_PERIOD_MINUTES).toBe(3);
  });

  test("OTP is six digits", () => {
    expect(TWO_FACTOR_OTP_DIGITS).toBe(6);
  });

  test("recent-auth window is five minutes", () => {
    expect(RECENT_AUTH_MAX_AGE_SECONDS).toBe(300);
  });
});
