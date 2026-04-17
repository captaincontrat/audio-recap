import { expect, test } from "@playwright/test";

import { resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("unauthenticated browsers requesting /dashboard are redirected to /sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("/api/auth/session reports no session for unauthenticated browsers", async ({ request }) => {
  const response = await request.get("/api/auth/session");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok: boolean; session: unknown };
  expect(body.ok).toBe(true);
  expect(body.session).toBeNull();
});

test("unauthenticated POST to /api/auth/resend-verification returns 401", async ({ request }) => {
  const response = await request.post("/api/auth/resend-verification", {
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", referer: "http://127.0.0.1:3000/" },
    data: {},
  });
  expect(response.status()).toBe(401);
  const body = (await response.json()) as { ok: boolean; code: string };
  expect(body.ok).toBe(false);
});

test("authenticated but unverified users trying to access /dashboard are redirected to /verify-email", async ({ page }) => {
  const email = `unverified-guard-${Date.now()}@example.com`;
  await signUpUser(page, email, "super-secret-pass-1234");

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/verify-email/);
});

test("verified users can access /dashboard directly", async ({ page, request }) => {
  const email = `verified-guard-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
});
