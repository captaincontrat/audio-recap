import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

import { fetchWorkspacesForEmail, resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";
import { seedTranscripts } from "./e2e/transcripts-helpers";

// End-to-end coverage for the workspace overview page introduced by
// `add-workspace-overview-and-default-landing`. The overview is the
// canonical workspace home and groups in-flight + failed transcripts
// (active work) separately from recently updated completed ones
// (library highlights), with a role-gated upload CTA.
//
// Tests pin down:
//   3.2 - the two activity groups, the failed-attention treatment, the
//         empty state, and the read-only no-CTA shape
//   3.3 - the access model: not-found for inaccessible workspaces, the
//         archived notice instead of activity, and that the role gate
//         omits the upload CTA for read_only viewers

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

type SignedInUser = {
  email: string;
  password: string;
  workspaceSlug: string;
  workspaceId: string;
};

async function signInFreshUser(page: Page, request: APIRequestContext, suffix: string): Promise<SignedInUser> {
  const email = `${suffix}-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);
  await page.waitForURL(/\/w\//);
  const summary = await fetchWorkspacesForEmail(request, email);
  const personal = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personal) throw new Error(`Expected personal workspace for ${email}`);
  return { email, password, workspaceSlug: personal.workspaceSlug, workspaceId: personal.workspaceId };
}

test("empty workspace shows the no-transcripts empty state and start-upload CTA", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "overview-empty");

  await page.goto(`/w/${user.workspaceSlug}`);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Workspace overview");
  await expect(page.getByTestId("overview-empty-state")).toBeVisible();
  await expect(page.getByTestId("overview-empty-state")).toContainText("No transcripts in this workspace yet");
  await expect(page.getByTestId("overview-empty-start-upload-cta")).toBeVisible();
  // The activity-group cards are mutually exclusive with the empty
  // state — we render one or the other, never both.
  await expect(page.getByTestId("overview-active-work")).toHaveCount(0);
  await expect(page.getByTestId("overview-library-highlights")).toHaveCount(0);
});

test("active-work group lists processing and failed transcripts; library-highlights lists only completed", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "overview-groups");

  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [
      { id: "transcript_completed_old", title: "Completed older", status: "completed", updatedAt: "2026-04-01T10:00:00.000Z" },
      { id: "transcript_completed_new", title: "Completed newer", status: "completed", updatedAt: "2026-04-08T10:00:00.000Z" },
      { id: "transcript_processing", title: "Still processing", status: "transcribing", updatedAt: "2026-04-09T10:00:00.000Z" },
      { id: "transcript_failed", title: "Needs attention", status: "failed", updatedAt: "2026-04-10T10:00:00.000Z" },
    ],
  });

  await page.goto(`/w/${user.workspaceSlug}`);

  // Active-work group: processing + failed only, ordered most-recent
  // updatedAt first so attention items rise to the top.
  const activeWork = page.getByTestId("overview-active-work");
  await expect(activeWork).toBeVisible();
  const activeRows = activeWork.getByTestId("overview-item-row");
  await expect(activeRows).toHaveCount(2);
  await expect(activeRows.nth(0)).toContainText("Needs attention");
  await expect(activeRows.nth(1)).toContainText("Still processing");

  // The failed row carries the attention marker so the visual treatment
  // can hook on it; processing rows do not.
  await expect(activeRows.nth(0)).toHaveAttribute("data-attention", "true");
  await expect(activeRows.nth(1)).not.toHaveAttribute("data-attention", "true");

  // Status badge for failed reads "Failed" so screen readers and
  // visual users converge on the same signal.
  const failedBadge = activeRows.nth(0).getByTestId("overview-status-badge");
  await expect(failedBadge).toHaveAttribute("data-status", "failed");
  await expect(failedBadge).toContainText("Failed");

  // Library highlights: completed only, ordered newest first.
  const highlights = page.getByTestId("overview-library-highlights");
  await expect(highlights).toBeVisible();
  const highlightRows = highlights.getByTestId("overview-item-row");
  await expect(highlightRows).toHaveCount(2);
  await expect(highlightRows.nth(0)).toContainText("Completed newer");
  await expect(highlightRows.nth(1)).toContainText("Completed older");
});

test("library highlights link out to the full transcripts library", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "overview-link");

  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_done", title: "Done", status: "completed" }],
  });

  await page.goto(`/w/${user.workspaceSlug}`);

  await page.getByTestId("overview-browse-library").click();
  await expect(page).toHaveURL(`/w/${user.workspaceSlug}/transcripts`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Transcripts");
});

test("start-upload CTA routes to the dedicated meeting submission surface", async ({ page, request }) => {
  // Pin down the spec scenario "Start-upload CTA routes to the
  // dedicated submission surface". Both CTA renderings must land on
  // `/w/<slug>/meetings/new`: the empty-state CTA when the workspace
  // has no transcripts, and the header CTA once the workspace has
  // activity to render.
  const user = await signInFreshUser(page, request, "overview-cta-nav");

  await page.goto(`/w/${user.workspaceSlug}`);
  await page.getByTestId("overview-empty-start-upload-cta").click();
  await expect(page).toHaveURL(`/w/${user.workspaceSlug}/meetings/new`);

  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_for_cta_nav", title: "Has activity", status: "completed" }],
  });

  await page.goto(`/w/${user.workspaceSlug}`);
  await page.getByTestId("overview-start-upload-cta").click();
  await expect(page).toHaveURL(`/w/${user.workspaceSlug}/meetings/new`);
});

test("read_only viewers see the overview without any upload CTA", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "overview-readonly");

  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    membershipRole: "read_only",
    transcripts: [
      { id: "transcript_readonly_done", title: "Visible to read_only", status: "completed" },
      { id: "transcript_readonly_failed", title: "Failed visible", status: "failed" },
    ],
  });

  await page.goto(`/w/${user.workspaceSlug}`);

  // Activity groups still render — read-only users can browse — but
  // both upload entry points are gone.
  await expect(page.getByTestId("overview-active-work")).toBeVisible();
  await expect(page.getByTestId("overview-library-highlights")).toBeVisible();
  await expect(page.getByTestId("overview-start-upload-cta")).toHaveCount(0);
  await expect(page.getByTestId("overview-empty-start-upload-cta")).toHaveCount(0);
});

test("read_only viewer with no transcripts sees an empty state without an upload CTA", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "overview-readonly-empty");

  // Seeding zero transcripts but still applying the role override is
  // the only way the test endpoint exposes to flip role without
  // creating data; the overview composition itself is independent of
  // the seed call so the resulting state is the realistic
  // "read_only viewer in an empty workspace" surface.
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    membershipRole: "read_only",
    transcripts: [],
  });

  await page.goto(`/w/${user.workspaceSlug}`);

  await expect(page.getByTestId("overview-empty-state")).toBeVisible();
  await expect(page.getByTestId("overview-empty-state")).toContainText("Once a member or admin submits a meeting");
  await expect(page.getByTestId("overview-empty-start-upload-cta")).toHaveCount(0);
});

test("workspace slug that the user cannot access returns not-found, not 200", async ({ browser, request }) => {
  // Two browser contexts so each has its own session cookie. Alice
  // owns a workspace; Bob attempts to load Alice's overview to prove
  // the access guard does not leak existence to outside accounts.
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const alice = await signInFreshUser(alicePage, aliceContext.request, "overview-cross-alice");

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signInFreshUser(bobPage, bobContext.request, "overview-cross-bob");

  await seedTranscripts(request, {
    workspaceSlug: alice.workspaceSlug,
    userEmail: alice.email,
    transcripts: [{ id: "transcript_alice_secret", title: "Alice private", status: "completed" }],
  });

  // Bob's browser hitting Alice's slug must surface the standard
  // 404 surface and never reveal Alice's data.
  const response = await bobPage.goto(`/w/${alice.workspaceSlug}`);
  expect(response?.status(), "cross-account workspace access status").toBe(404);
  await expect(bobPage.getByText("Alice private")).toHaveCount(0);

  await aliceContext.close();
  await bobContext.close();
});

test("archived workspace shows the archived notice instead of any activity groups", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "overview-archived");

  // Seed first so we can prove the archived notice replaces real
  // data, not that it just renders an empty workspace.
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [
      { id: "transcript_in_archived", title: "Hidden by archive", status: "completed" },
      { id: "transcript_active_in_archived", title: "Hidden processing", status: "transcribing" },
    ],
  });

  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    archiveWorkspace: true,
    transcripts: [],
  });

  await page.goto(`/w/${user.workspaceSlug}`);

  await expect(page.getByTestId("overview-archived-notice")).toBeVisible();
  await expect(page.getByTestId("overview-archived-notice")).toContainText("Workspace archived");
  await expect(page.getByText("Hidden by archive")).toHaveCount(0);
  await expect(page.getByText("Hidden processing")).toHaveCount(0);
  await expect(page.getByTestId("overview-active-work")).toHaveCount(0);
  await expect(page.getByTestId("overview-library-highlights")).toHaveCount(0);
  await expect(page.getByTestId("overview-empty-state")).toHaveCount(0);
});

test("unauthenticated visit to the overview redirects to sign-in", async ({ page }) => {
  // We do not need an existing workspace here — the auth guard runs
  // before the slug is even resolved, so an arbitrary slug exercises
  // the same code path.
  await page.goto("/w/some-arbitrary-slug");
  await expect(page).toHaveURL(/\/sign-in/);
});
