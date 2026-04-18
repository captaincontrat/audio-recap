import { expect, test } from "@playwright/test";

import { extractTokenFromUrl, resetDatabase, signUpUser, waitForEmail } from "./e2e/helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("verification link activates the account and lands on the workspace overview", async ({ page, request }) => {
  const email = `verify-${Date.now()}@example.com`;
  await signUpUser(page, email, "super-secret-pass-1234");

  const emailMessage = await waitForEmail(request, email, "verification");
  expect(emailMessage.url).toContain("/verify-email?token=");
  const token = extractTokenFromUrl(emailMessage.url);

  await page.goto(`/verify-email?token=${token}`);
  // `/dashboard` server-side redirects to the user's default workspace
  // overview, so we wait on the final `/w/<slug>` URL rather than the
  // intermediate dashboard URL, which may flash too briefly to observe.
  await page.waitForURL(/\/w\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Workspace overview");
});

test("expired or consumed tokens surface a retry path", async ({ page, request }) => {
  const email = `verify-expired-${Date.now()}@example.com`;
  await signUpUser(page, email, "super-secret-pass-1234");
  const message = await waitForEmail(request, email, "verification");
  const token = extractTokenFromUrl(message.url);

  await page.goto(`/verify-email?token=${token}`);
  await page.waitForURL(/\/w\//);

  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole("alert")).toContainText(/expired|already used|invalid/i);
  await expect(page.getByRole("button", { name: /resend verification email/i })).toBeVisible();
});

test("resend verification issues a new email and invalidates the previous one", async ({ page, request }) => {
  const email = `resend-${Date.now()}@example.com`;
  await signUpUser(page, email, "super-secret-pass-1234");
  const first = await waitForEmail(request, email, "verification");
  const firstToken = extractTokenFromUrl(first.url);

  await page.goto("/verify-email");
  await page.getByRole("button", { name: /resend verification email/i }).click();
  await expect(page.getByRole("status")).toContainText(/new verification email/i);

  const second = await waitForEmail(request, email, "verification", 15_000);
  expect(second.url).not.toEqual(first.url);
  const secondToken = extractTokenFromUrl(second.url);

  await page.goto(`/verify-email?token=${firstToken}`);
  await expect(page.getByRole("alert")).toContainText(/expired|already used|invalid/i);

  await page.goto(`/verify-email?token=${secondToken}`);
  await page.waitForURL(/\/w\//);
});
