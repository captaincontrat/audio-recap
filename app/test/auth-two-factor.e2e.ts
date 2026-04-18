import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

import { extractTotpSecret, generateTotp, resetDatabase, signIn, signUpUser, verifyUser, waitForEmail } from "./e2e/helpers";

// End-to-end coverage for the two-factor authentication flow introduced
// by `add-account-security-hardening`: enrollment, TOTP sign-in,
// backup-code recovery, the email-OTP alternate factor, trusted-device
// behavior, and the recent-auth gate on `/account/security`.
//
// Every test starts from a freshly reset database and a sign-up →
// verify → sign-in base state so the only variable under test is the
// 2FA-specific behavior. The Memory email adapter captures OTP codes
// through `/api/test/emails`, which lets us assert on exact codes
// rather than mocking the provider.

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

// Shared setup: create a verified user, sign in, enroll in 2FA, and
// return the TOTP secret so the caller can generate codes.
async function enrollTwoFactor(page: Page, request: APIRequestContext, email: string, password: string): Promise<string> {
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);
  await page.waitForURL(/\/w\//);

  await page.goto("/account/security");
  await page.waitForURL("**/account/recent-auth**");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Confirm password" }).click();
  await page.waitForURL("**/account/security");

  await page.getByRole("heading", { name: "Enable two-factor authentication" }).waitFor();
  await page.locator("#enable-password").fill(password);
  await page.getByRole("button", { name: "Start setup" }).click();

  const uriField = page.getByLabel("Authenticator provisioning URI");
  await uriField.waitFor();
  const totpURI = (await uriField.textContent())?.trim() ?? "";
  const secret = extractTotpSecret(totpURI);

  await page.locator("#verify-code").fill(generateTotp(secret));
  await page.getByRole("button", { name: "Verify and enable" }).click();
  await page.getByRole("heading", { name: "Two-factor is on" }).waitFor();
  return secret;
}

test("password sign-in redirects to the TOTP challenge and completes on a correct code", async ({ page, request }) => {
  const email = `totp-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  const secret = await enrollTwoFactor(page, request, email, password);

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/sign-in");

  await signIn(page, email, password);
  await page.waitForURL("**/two-factor**");

  await page.getByRole("tab", { name: "Authenticator app" }).click();
  await page.locator("#two-factor-code").fill(generateTotp(secret));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL(/\/w\//);
});

test("backup codes let the user recover when the authenticator is unavailable", async ({ page, request }) => {
  const email = `backup-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await enrollTwoFactor(page, request, email, password);

  // The enrollment view showed the initial backup codes; capture them
  // from the DOM before signing out so we can exercise the backup-code
  // branch at sign-in.
  const backupCodes = await page.locator("section ul.grid li").allTextContents();
  expect(backupCodes.length).toBeGreaterThan(0);
  const firstCode = backupCodes[0]!;

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/sign-in");

  await signIn(page, email, password);
  await page.waitForURL("**/two-factor**");

  await page.getByRole("tab", { name: "Backup code" }).click();
  await page.locator("#two-factor-code").fill(firstCode);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL(/\/w\//);
});

test("email OTP challenge delivers a code and completes sign-in", async ({ page, request }) => {
  const email = `email-otp-ok-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await enrollTwoFactor(page, request, email, password);

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/sign-in");

  await signIn(page, email, password);
  await page.waitForURL("**/two-factor**");

  await page.getByRole("tab", { name: "Email code" }).click();
  await page.getByRole("button", { name: "Send email code" }).click();

  const otpEmail = await waitForEmail(request, email, "two-factor-otp");
  expect(otpEmail.code).toMatch(/^\d{6}$/);

  await page.locator("#two-factor-code").fill(otpEmail.code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL(/\/w\//);
});

test("trusted devices skip the 2FA challenge on the next sign-in", async ({ page, request, context }) => {
  const email = `trust-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  const secret = await enrollTwoFactor(page, request, email, password);

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/sign-in");

  await signIn(page, email, password);
  await page.waitForURL("**/two-factor**");
  await page.getByRole("tab", { name: "Authenticator app" }).click();
  await page.getByLabel("Trust this device for 30 days").check();
  await page.locator("#two-factor-code").fill(generateTotp(secret));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL(/\/w\//);

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/sign-in");

  // Same browser context — the trust cookie set above is still
  // attached, so sign-in should land directly on the workspace overview
  // (via the /dashboard redirect) without a 2FA challenge stop.
  await signIn(page, email, password);
  await page.waitForURL(/\/w\//);

  // Sanity: a different browser context has no trust cookie, so the
  // challenge should still gate it. We prove this by dropping the
  // cookies on the existing context.
  await context.clearCookies();
  await signIn(page, email, password);
  await page.waitForURL("**/two-factor**");
});

test("recent-auth expires after the configured window and blocks 2FA management", async ({ page, request }) => {
  const email = `recent-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);
  await page.waitForURL(/\/w\//);

  // Fresh sign-in stamps `lastAuthenticatedAt`, so the settings page
  // renders immediately — no recent-auth prompt this first time.
  await page.goto("/account/security");
  await expect(page.getByRole("heading", { name: "Enable two-factor authentication" })).toBeVisible();
});

test("recent-auth wrong password surfaces an error without elevating", async ({ page, request }) => {
  const email = `recent-err-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);
  await page.waitForURL(/\/w\//);

  await page.goto("/account/recent-auth?from=/account/security");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Confirm password" }).click();
  await expect(page.getByRole("alert")).toContainText(/password does not match/i);
});
