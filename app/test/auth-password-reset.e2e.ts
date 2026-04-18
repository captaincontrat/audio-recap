import { expect, test } from "@playwright/test";

import { extractTokenFromUrl, fetchEmailsFor, resetDatabase, signIn, signUpUser, verifyUser, waitForEmail } from "./e2e/helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("users can reset their password and sign in with the new credentials", async ({ page, request }) => {
  const email = `reset-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  const newPassword = "another-super-secret-5678";

  await signUpUser(page, email, password);
  await verifyUser(request, page, email);

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /send reset link/i }).click();
  await expect(page.getByRole("status")).toContainText(/If an account exists/i);

  const resetEmail = await waitForEmail(request, email, "password-reset");
  const token = extractTokenFromUrl(resetEmail.url);

  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel(/new password/i).fill(newPassword);
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page.getByRole("status")).toContainText(/updated/i);

  await signIn(page, email, newPassword);
  // After password reset, sign-in still routes through `/dashboard`,
  // which redirects to the user's default workspace overview.
  await expect(page).toHaveURL(/\/w\//);
});

test("password reset link cannot be replayed", async ({ page, request }) => {
  const email = `reset-replay-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /send reset link/i }).click();

  const resetEmail = await waitForEmail(request, email, "password-reset");
  const token = extractTokenFromUrl(resetEmail.url);

  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel(/new password/i).fill("another-super-secret-5678");
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page.getByRole("status")).toContainText(/updated/i);

  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel(/new password/i).fill("yet-another-secret-pass-9012");
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page.getByRole("alert")).toContainText(/expired|already used|invalid/i);
});

test("forgot password returns a neutral response for unknown addresses", async ({ page, request }) => {
  const email = `no-account-${Date.now()}@example.com`;
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /send reset link/i }).click();
  await expect(page.getByRole("status")).toContainText(/If an account exists/i);

  const emails = await fetchEmailsFor(request, email);
  expect(emails).toHaveLength(0);
});
