import { expect, test } from "@playwright/test";

import { resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("verified users can sign in and land on their workspace overview", async ({ page, request }) => {
  const email = `signin-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";

  await signUpUser(page, email, password);
  await verifyUser(request, page, email);

  await signIn(page, email, password);
  // Sign-in submits with `callbackURL=/dashboard`; the dashboard route
  // is now a server-side redirect to the user's default workspace
  // overview, so the browser ends up on `/w/<slug>`.
  await expect(page).toHaveURL(/\/w\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Workspace overview");
});

test("unverified users are sent back to the verification flow", async ({ page }) => {
  const email = `unverified-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";

  await signUpUser(page, email, password);
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/verify-email/);
});

test("invalid credentials produce a generic error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("missing@example.com");
  await page.getByLabel("Password").fill("super-secret-pass-1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toContainText(/incorrect/i);
});

test("sign-out revokes the session", async ({ page, request }) => {
  const email = `signout-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);

  await page.waitForURL(/\/w\//);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});
