import { expect, test } from "@playwright/test";

import { fetchWorkspacesForEmail, resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";
import { type DetailApiResponse, type LibraryApiResponse, seedTranscripts } from "./e2e/transcripts-helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

async function signInFreshUser(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext, suffix: string) {
  const email = `${suffix}-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);
  await page.waitForURL("**/dashboard");
  const summary = await fetchWorkspacesForEmail(request, email);
  const personalWorkspace = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personalWorkspace) {
    throw new Error(`Expected personal workspace for ${email}`);
  }
  return { email, password, workspaceSlug: personalWorkspace.workspaceSlug, workspaceId: personalWorkspace.workspaceId };
}

test("library lists transcripts scoped to the current workspace, sorted newest first", async ({ page, request }) => {
  const alice = await signInFreshUser(page, request, "library-scope");

  await seedTranscripts(request, {
    workspaceSlug: alice.workspaceSlug,
    userEmail: alice.email,
    transcripts: [
      {
        id: "transcript_alice_1",
        title: "Alpha",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
      {
        id: "transcript_alice_2",
        title: "Beta",
        createdAt: "2026-04-05T10:00:00.000Z",
        updatedAt: "2026-04-05T10:00:00.000Z",
      },
      {
        id: "transcript_alice_3",
        title: "Gamma",
        createdAt: "2026-04-10T10:00:00.000Z",
        updatedAt: "2026-04-10T10:00:00.000Z",
      },
    ],
  });

  const response = await page.request.get(`/api/workspaces/${alice.workspaceSlug}/transcripts`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as LibraryApiResponse;
  expect(body.ok).toBe(true);
  expect(body.items?.map((i) => i.id)).toEqual(["transcript_alice_3", "transcript_alice_2", "transcript_alice_1"]);
  expect(body.nextCursor).toBeNull();
  expect(body.items?.[0].displayTitle).toBe("Gamma");
});

test("library hides transcripts that belong to a different workspace", async ({ browser, request }) => {
  const aliceContext = await browser.newContext();
  const aliceRequest = aliceContext.request;
  const alicePage = await aliceContext.newPage();
  const alice = await signInFreshUser(alicePage, aliceRequest, "cross-alice");

  const bobContext = await browser.newContext();
  const bobRequest = bobContext.request;
  const bobPage = await bobContext.newPage();
  const bob = await signInFreshUser(bobPage, bobRequest, "cross-bob");

  await seedTranscripts(request, {
    workspaceSlug: alice.workspaceSlug,
    userEmail: alice.email,
    transcripts: [{ id: "transcript_alice_only", title: "Alice private" }],
  });
  await seedTranscripts(request, {
    workspaceSlug: bob.workspaceSlug,
    userEmail: bob.email,
    transcripts: [{ id: "transcript_bob_only", title: "Bob private" }],
  });

  const aliceLibrary = await alicePage.request.get(`/api/workspaces/${alice.workspaceSlug}/transcripts`);
  const aliceBody = (await aliceLibrary.json()) as LibraryApiResponse;
  expect(aliceBody.items?.map((i) => i.id)).toEqual(["transcript_alice_only"]);

  const bobLibrary = await bobPage.request.get(`/api/workspaces/${bob.workspaceSlug}/transcripts`);
  const bobBody = (await bobLibrary.json()) as LibraryApiResponse;
  expect(bobBody.items?.map((i) => i.id)).toEqual(["transcript_bob_only"]);

  const bobProbingAlice = await bobPage.request.get(`/api/workspaces/${alice.workspaceSlug}/transcripts`);
  expect(bobProbingAlice.status()).toBe(404);
  const bobProbingAliceBody = (await bobProbingAlice.json()) as LibraryApiResponse;
  expect(bobProbingAliceBody.ok).toBe(false);
  expect(bobProbingAliceBody.code).toBe("access_denied");

  const bobProbingAliceDetail = await bobPage.request.get(`/api/workspaces/${alice.workspaceSlug}/transcripts/transcript_alice_only`);
  expect(bobProbingAliceDetail.status()).toBe(404);

  const bobProbingInOwnWorkspace = await bobPage.request.get(`/api/workspaces/${bob.workspaceSlug}/transcripts/transcript_alice_only`);
  expect(bobProbingInOwnWorkspace.status()).toBe(404);
  const bobProbingInOwnBody = (await bobProbingInOwnWorkspace.json()) as DetailApiResponse;
  expect(bobProbingInOwnBody.ok).toBe(false);
  expect(bobProbingInOwnBody.code).toBe("not_found");

  await aliceContext.close();
  await bobContext.close();
});

test("read_only, member, and admin memberships can all list transcripts", async ({ page, request }) => {
  for (const role of ["read_only", "member", "admin"] as const) {
    await resetDatabase(request);
    const user = await signInFreshUser(page, request, `role-${role}`);
    await seedTranscripts(request, {
      workspaceSlug: user.workspaceSlug,
      userEmail: user.email,
      membershipRole: role,
      transcripts: [{ id: `transcript_${role}_1`, title: `Role ${role}` }],
    });
    const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts`);
    expect(response.status(), `role ${role} library fetch`).toBe(200);
    const body = (await response.json()) as LibraryApiResponse;
    expect(body.items?.map((i) => i.id)).toEqual([`transcript_${role}_1`]);

    const detail = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_${role}_1`);
    expect(detail.status(), `role ${role} detail fetch`).toBe(200);
  }
});

test("archived workspaces lock out library and detail reads with workspace_archived", async ({ page, request }) => {
  const alice = await signInFreshUser(page, request, "archived-lockout");
  await seedTranscripts(request, {
    workspaceSlug: alice.workspaceSlug,
    userEmail: alice.email,
    transcripts: [{ id: "transcript_archive_1", title: "In archived workspace" }],
  });

  const beforeArchive = await page.request.get(`/api/workspaces/${alice.workspaceSlug}/transcripts`);
  expect(beforeArchive.status()).toBe(200);

  await seedTranscripts(request, {
    workspaceSlug: alice.workspaceSlug,
    userEmail: alice.email,
    archiveWorkspace: true,
    transcripts: [],
  });

  const libraryResponse = await page.request.get(`/api/workspaces/${alice.workspaceSlug}/transcripts`);
  expect(libraryResponse.status()).toBe(409);
  const libraryBody = (await libraryResponse.json()) as LibraryApiResponse;
  expect(libraryBody.ok).toBe(false);
  expect(libraryBody.code).toBe("workspace_archived");

  const detailResponse = await page.request.get(`/api/workspaces/${alice.workspaceSlug}/transcripts/transcript_archive_1`);
  expect(detailResponse.status()).toBe(409);
  const detailBody = (await detailResponse.json()) as DetailApiResponse;
  expect(detailBody.code).toBe("workspace_archived");
});
