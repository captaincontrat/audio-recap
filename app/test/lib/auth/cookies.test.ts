import { describe, expect, test } from "vitest";

import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookies";

describe("sessionCookieOptions", () => {
  test("returns the production cookie attributes with Secure flag", () => {
    const options = sessionCookieOptions({ isProduction: true, maxAgeSeconds: 1000 });

    expect(options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 1000,
    });
  });

  test("returns the development cookie attributes without Secure flag", () => {
    const options = sessionCookieOptions({ isProduction: false, maxAgeSeconds: 60 });

    expect(options.secure).toBe(false);
    expect(options.maxAge).toBe(60);
    expect(options.sameSite).toBe("lax");
    expect(options.httpOnly).toBe(true);
  });

  test("exposes a stable cookie name for downstream callers", () => {
    expect(SESSION_COOKIE_NAME).toBe("summitdown.session_token");
  });
});
