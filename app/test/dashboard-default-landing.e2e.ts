import { expect, test } from "@playwright/test";

import { fetchWorkspacesForEmail, resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";

// End-to-end coverage for the `/dashboard` default-landing redirect
// owned by the `workspace-foundation` capability after
// `add-workspace-overview-and-default-landing`. The dashboard is no
// longer a standalone product surface; it resolves the user's default
// workspace and server-side redirects to that workspace's overview at
// `/w/<slug>`. These tests pin down the contract exposed by that
// passthrough so we cannot accidentally regress to:
//   - landing on a generic non-workspace page
//   - dropping an explicit `returnTo` deep link
//   - honoring an open-redirect target
//   - bouncing back to `/dashboard` in an infinite loop

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("verified users land on their personal workspace overview", async ({ page, request }) => {
  const email = `landing-personal-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);

  const summary = await fetchWorkspacesForEmail(request, email);
  const personal = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personal) throw new Error(`Expected personal workspace for ${email}`);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(`/w/${personal.workspaceSlug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Workspace overview");
});

test("explicit returnTo for an in-app path wins over default landing", async ({ page, request }) => {
  const email = `landing-returnto-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);

  const summary = await fetchWorkspacesForEmail(request, email);
  const personal = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personal) throw new Error(`Expected personal workspace for ${email}`);

  // The transcripts library route is the canonical "deep link to a
  // workspace surface" used by share/back-navigation flows. We use it
  // here so the assertion confirms the exact same URL the user
  // requested is what they reach, not just "some workspace path".
  const target = `/w/${personal.workspaceSlug}/transcripts`;
  await page.goto(`/dashboard?returnTo=${encodeURIComponent(target)}`);
  await expect(page).toHaveURL(target);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Transcripts");
});

test("legacy from alias is honored as an explicit destination", async ({ page, request }) => {
  const email = `landing-from-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);

  const summary = await fetchWorkspacesForEmail(request, email);
  const personal = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personal) throw new Error(`Expected personal workspace for ${email}`);

  const target = `/w/${personal.workspaceSlug}/transcripts`;
  await page.goto(`/dashboard?from=${encodeURIComponent(target)}`);
  await expect(page).toHaveURL(target);
});

test("returnTo to /dashboard is ignored to prevent a redirect loop", async ({ page, request }) => {
  const email = `landing-loop-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);

  const summary = await fetchWorkspacesForEmail(request, email);
  const personal = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personal) throw new Error(`Expected personal workspace for ${email}`);

  await page.goto("/dashboard?returnTo=/dashboard");
  await expect(page).toHaveURL(`/w/${personal.workspaceSlug}`);
});

test("returnTo to an external host is ignored to prevent open redirect", async ({ page, request }) => {
  const email = `landing-external-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);

  const summary = await fetchWorkspacesForEmail(request, email);
  const personal = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personal) throw new Error(`Expected personal workspace for ${email}`);

  // Both protocol-relative (`//evil.example.com`) and
  // absolute-with-scheme (`https://evil.example.com`) variants must be
  // refused. We prove both arms by hitting them in sequence.
  await page.goto("/dashboard?returnTo=//evil.example.com/landing");
  await expect(page).toHaveURL(`/w/${personal.workspaceSlug}`);

  await page.goto("/dashboard?returnTo=https%3A%2F%2Fevil.example.com%2Flanding");
  await expect(page).toHaveURL(`/w/${personal.workspaceSlug}`);
});
