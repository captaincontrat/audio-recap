import { expect, test } from "@playwright/test";

import { fetchEmailsFor, fetchWorkspacesForEmail, resetDatabase, signUpUser, waitForEmail } from "./e2e/helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("sign-up creates an account and sends a verification email", async ({ page, request }) => {
  const email = `new-${Date.now()}@example.com`;

  await signUpUser(page, email, "super-secret-pass-1234");

  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.getByRole("status")).toContainText("verification email");

  const captured = await waitForEmail(request, email, "verification");
  expect(captured.subject).toContain("Verify your Summitdown email address");
});

test("sign-up with duplicate email shows a friendly error and does not send a second email", async ({ page, request }) => {
  const email = `dupe-${Date.now()}@example.com`;
  await signUpUser(page, email, "super-secret-pass-1234");

  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("another-secret-pass-1234");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("alert")).toContainText(/already exists|sign in/i);

  const emails = await fetchEmailsFor(request, email);
  expect(emails.length).toBe(1);
});

test("sign-up rejects short passwords without sending an email", async ({ page, request }) => {
  const email = `weak-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText(/at least 12/i)).toBeVisible();
  const emails = await fetchEmailsFor(request, email);
  expect(emails.length).toBe(0);
});

test("sign-up provisions a personal workspace with the user as admin", async ({ page, request }) => {
  const email = `ws-${Date.now()}@example.com`;
  await signUpUser(page, email, "super-secret-pass-1234");

  // The Better Auth `user.create.after` hook provisions the personal
  // workspace inline with the sign-up transaction, but the `/verify-email`
  // navigation races the DB write in some environments; retry briefly to
  // stay deterministic under load.
  let summary = await fetchWorkspacesForEmail(request, email);
  const deadline = Date.now() + 5_000;
  while (summary.workspaces.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    summary = await fetchWorkspacesForEmail(request, email);
  }

  expect(summary.userId).not.toBeNull();
  expect(summary.personalOwned).toBe(1);
  expect(summary.workspaces).toHaveLength(1);
  const only = summary.workspaces[0];
  expect(only.workspaceType).toBe("personal");
  expect(only.role).toBe("admin");
  expect(only.isPersonalOwner).toBe(true);
  expect(only.workspaceSlug.startsWith("p-")).toBe(true);
});
