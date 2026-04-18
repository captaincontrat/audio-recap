import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

import { fetchWorkspacesForEmail, resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";
import { type DetailApiResponse, type LibraryApiResponse, type SeedTranscriptSpec, seedTranscripts } from "./e2e/transcripts-helpers";

// End-to-end coverage for `add-transcript-curation-controls`. The pure
// decision modules (`authorization`, `validation`, `queries` decision
// helpers, `http-status`) are unit-tested directly; this file covers
// the DB/route-touching surface the vitest config excludes:
//   - Task 4.1: the PATCH surface (rename, tag normalization, important
//               toggling, role enforcement, active-workspace lockout)
//   - Task 4.2: the library GET surface's new sort/filter vocabulary
//   - Task 4.3: the DELETE surface (member-owned, admin, deleted-creator
//               fallback, active-workspace lockout, not-found for out-
//               of-workspace records)

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
  await page.waitForURL("**/dashboard");
  const summary = await fetchWorkspacesForEmail(request, email);
  const personalWorkspace = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personalWorkspace) {
    throw new Error(`Expected personal workspace for ${email}`);
  }
  return { email, password, workspaceSlug: personalWorkspace.workspaceSlug, workspaceId: personalWorkspace.workspaceId };
}

// --- Task 4.1: Curation PATCH --------------------------------------

test("PATCH customTitle derives a new displayTitle while leaving the source title untouched", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-rename");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_rename", title: "Original title" }],
  });

  const response = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_rename`, {
    headers: { "content-type": "application/json" },
    data: { customTitle: "  Renamed for the team  " },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as DetailApiResponse;
  expect(body.ok).toBe(true);
  expect(body.transcript?.customTitle).toBe("Renamed for the team");
  expect(body.transcript?.displayTitle).toBe("Renamed for the team");

  const refetched = (await (await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_rename`)).json()) as DetailApiResponse;
  expect(refetched.transcript?.customTitle).toBe("Renamed for the team");
  expect(refetched.transcript?.displayTitle).toBe("Renamed for the team");
});

test("PATCH customTitle = null clears the override and falls back to the source title", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-clear-title");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_clear", title: "Source title", customTitle: "Override" }],
  });

  const response = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_clear`, {
    headers: { "content-type": "application/json" },
    data: { customTitle: null },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as DetailApiResponse;
  expect(body.transcript?.customTitle).toBeNull();
  expect(body.transcript?.displayTitle).toBe("Source title");
});

test("PATCH tags normalizes (trim, lowercase, dedupe) and updates the derived sort key", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-tags");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [
      { id: "transcript_tag_a", title: "Alpha", tags: ["research"] },
      { id: "transcript_tag_b", title: "Bravo", tags: ["design"] },
    ],
  });

  const patchResponse = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_tag_a`, {
    headers: { "content-type": "application/json" },
    data: { tags: [" Product ", "product", "Design", "design"] },
  });
  expect(patchResponse.status()).toBe(200);
  const patchBody = (await patchResponse.json()) as DetailApiResponse;
  expect(patchBody.transcript?.tags).toEqual(["product", "design"]);

  // The derived tag sort key is exercised indirectly via `tag_list_asc`
  // (covered below). Here we just confirm the detail payload reflects
  // the normalized tag list a subsequent fetch would see.
  const refetched = (await (await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_tag_a`)).json()) as DetailApiResponse;
  expect(refetched.transcript?.tags).toEqual(["product", "design"]);
});

test("PATCH tags = [] clears the list and the derived sort key (untagged rows drop from tag sorts)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-clear-tags");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [
      { id: "transcript_clear_tag", title: "Alpha", tags: ["research", "design"] },
      { id: "transcript_with_tags", title: "Bravo", tags: ["zebra"] },
    ],
  });

  const patchResponse = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_clear_tag`, {
    headers: { "content-type": "application/json" },
    data: { tags: [] },
  });
  expect(patchResponse.status()).toBe(200);
  const patchBody = (await patchResponse.json()) as DetailApiResponse;
  expect(patchBody.transcript?.tags).toEqual([]);

  // `tag_list_asc` puts tagged rows first; the cleared row should
  // collapse to the end since its `tagSortKey` is now null.
  const sortedAsc = (await (await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?sort=tag_list_asc`)).json()) as LibraryApiResponse;
  expect(sortedAsc.items?.map((i) => i.id)).toEqual(["transcript_with_tags", "transcript_clear_tag"]);
});

test("PATCH isImportant toggles the flag and surfaces the state on the detail payload", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-important");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_imp", title: "Important toggle", isImportant: false }],
  });

  const onResponse = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_imp`, {
    headers: { "content-type": "application/json" },
    data: { isImportant: true },
  });
  const onBody = (await onResponse.json()) as DetailApiResponse;
  expect(onBody.transcript?.isImportant).toBe(true);

  const offResponse = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_imp`, {
    headers: { "content-type": "application/json" },
    data: { isImportant: false },
  });
  const offBody = (await offResponse.json()) as DetailApiResponse;
  expect(offBody.transcript?.isImportant).toBe(false);
});

test("PATCH customTitle over the length limit is rejected with invalid_patch", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-title-too-long");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_too_long", title: "Alpha" }],
  });

  // MAX_CUSTOM_TITLE_LENGTH is 200; any string over that must refuse.
  const tooLong = "a".repeat(201);
  const response = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_too_long`, {
    headers: { "content-type": "application/json" },
    data: { customTitle: tooLong },
  });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { ok: boolean; code?: string };
  expect(body.ok).toBe(false);
  expect(body.code).toBe("invalid_patch");
});

test("PATCH tags over the count/length limits are rejected with invalid_patch", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-tags-invalid");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_tag_limits", title: "Alpha" }],
  });

  // MAX_TAG_COUNT is 20; anything over that refuses.
  const tooMany = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
  const countResponse = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_tag_limits`, {
    headers: { "content-type": "application/json" },
    data: { tags: tooMany },
  });
  expect(countResponse.status()).toBe(400);
  expect(((await countResponse.json()) as { code?: string }).code).toBe("invalid_patch");

  // MAX_TAG_LENGTH is 50 characters.
  const lengthResponse = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_tag_limits`, {
    headers: { "content-type": "application/json" },
    data: { tags: ["z".repeat(51)] },
  });
  expect(lengthResponse.status()).toBe(400);
  expect(((await lengthResponse.json()) as { code?: string }).code).toBe("invalid_patch");
});

test("PATCH with an empty body is rejected with invalid_patch (nothing to apply)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-empty");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_empty_patch", title: "Alpha" }],
  });

  const response = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_empty_patch`, {
    headers: { "content-type": "application/json" },
    data: {},
  });
  expect(response.status()).toBe(400);
  expect(((await response.json()) as { code?: string }).code).toBe("invalid_patch");
});

test("PATCH is rejected for read_only members (role forbidden)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-readonly");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    membershipRole: "read_only",
    transcripts: [{ id: "transcript_read_only", title: "Hands off" }],
  });

  const response = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_read_only`, {
    headers: { "content-type": "application/json" },
    data: { customTitle: "Attempted rename" },
  });
  expect(response.status()).toBe(403);
  expect(((await response.json()) as { code?: string }).code).toBe("forbidden");
});

test("PATCH is allowed for member and admin roles", async ({ page, request }) => {
  for (const role of ["member", "admin"] as const) {
    await resetDatabase(request);
    const user = await signInFreshUser(page, request, `patch-${role}`);
    await seedTranscripts(request, {
      workspaceSlug: user.workspaceSlug,
      userEmail: user.email,
      membershipRole: role,
      transcripts: [{ id: `transcript_${role}`, title: "Alpha" }],
    });

    const response = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_${role}`, {
      headers: { "content-type": "application/json" },
      data: { isImportant: true },
    });
    expect(response.status(), `role ${role} should be allowed to patch`).toBe(200);
    const body = (await response.json()) as DetailApiResponse;
    expect(body.transcript?.isImportant).toBe(true);
  }
});

test("PATCH locks out archived workspaces with workspace_archived", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "patch-archived");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_archived_patch", title: "Alpha" }],
  });
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    archiveWorkspace: true,
    transcripts: [],
  });

  const response = await page.request.patch(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_archived_patch`, {
    headers: { "content-type": "application/json" },
    data: { isImportant: true },
  });
  expect(response.status()).toBe(409);
  expect(((await response.json()) as { code?: string }).code).toBe("workspace_archived");
});

test("PATCH cannot reach out-of-workspace records (404 rather than a cross-workspace leak)", async ({ browser, request }) => {
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const alice = await signInFreshUser(alicePage, aliceContext.request, "patch-alice");

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  const bob = await signInFreshUser(bobPage, bobContext.request, "patch-bob");

  await seedTranscripts(request, {
    workspaceSlug: alice.workspaceSlug,
    userEmail: alice.email,
    transcripts: [{ id: "transcript_alice_private", title: "Alice's transcript" }],
  });

  // Bob tries to patch Alice's transcript through his own workspace
  // slug and gets a generic `not_found`, not any leak of existence.
  const bobProbe = await bobPage.request.patch(`/api/workspaces/${bob.workspaceSlug}/transcripts/transcript_alice_private`, {
    headers: { "content-type": "application/json" },
    data: { isImportant: true },
  });
  expect(bobProbe.status()).toBe(404);
  expect(((await bobProbe.json()) as { code?: string }).code).toBe("not_found");

  await aliceContext.close();
  await bobContext.close();
});

// --- Task 4.2: Library sort + filter -------------------------------

const CURATION_FIXTURES: SeedTranscriptSpec[] = [
  {
    id: "transcript_imp_alpha",
    title: "Important alpha",
    tags: ["alpha", "zulu"],
    isImportant: true,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
  },
  {
    id: "transcript_imp_beta",
    title: "Important beta",
    tags: ["beta"],
    isImportant: true,
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-04-05T10:00:00.000Z",
  },
  {
    id: "transcript_plain_alpha",
    title: "Plain alpha",
    tags: ["alpha"],
    isImportant: false,
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
  },
  {
    id: "transcript_plain_untagged",
    title: "Plain untagged",
    tags: [],
    isImportant: false,
    createdAt: "2026-04-15T10:00:00.000Z",
    updatedAt: "2026-04-15T10:00:00.000Z",
  },
];

test("library sort=important_first puts important rows ahead of plain rows (then newest first)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "sort-imp-first");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?sort=important_first`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as LibraryApiResponse;
  expect(body.items?.map((i) => i.id)).toEqual(["transcript_imp_beta", "transcript_imp_alpha", "transcript_plain_untagged", "transcript_plain_alpha"]);
});

test("library sort=important_last puts plain rows ahead of important rows (then oldest first)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "sort-imp-last");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?sort=important_last`);
  const body = (await response.json()) as LibraryApiResponse;
  expect(body.items?.map((i) => i.id)).toEqual(["transcript_plain_alpha", "transcript_plain_untagged", "transcript_imp_alpha", "transcript_imp_beta"]);
});

test("library sort=tag_list_asc orders tagged rows by their derived sort key and pushes untagged rows to the end", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "sort-tag-asc");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?sort=tag_list_asc`);
  const body = (await response.json()) as LibraryApiResponse;
  expect(body.items?.map((i) => i.id)).toEqual([
    "transcript_plain_alpha", // sort key "alpha"
    "transcript_imp_alpha", // sort key "alpha\x01zulu" (SOH < any printable char)
    "transcript_imp_beta", // sort key "beta"
    "transcript_plain_untagged", // null sort key -> last
  ]);
});

test("library sort=tag_list_desc puts untagged rows first (NULLS-FIRST) and reverses the tag sort below them", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "sort-tag-desc");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?sort=tag_list_desc`);
  const body = (await response.json()) as LibraryApiResponse;
  // DESC default in Postgres is NULLS-FIRST, which matches "untagged
  // before tagged" per spec. Among tagged rows, sort keys compare as
  // "beta" > "alpha\x01zulu" > "alpha" in DESC order.
  expect(body.items?.map((i) => i.id)).toEqual(["transcript_plain_untagged", "transcript_imp_beta", "transcript_imp_alpha", "transcript_plain_alpha"]);
});

test("library important=true restricts results to important rows", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "filter-imp-true");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?important=true`);
  const body = (await response.json()) as LibraryApiResponse;
  expect(body.items?.map((i) => i.id).sort()).toEqual(["transcript_imp_alpha", "transcript_imp_beta"]);
});

test("library important=false restricts results to non-important rows", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "filter-imp-false");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?important=false`);
  const body = (await response.json()) as LibraryApiResponse;
  expect(body.items?.map((i) => i.id).sort()).toEqual(["transcript_plain_alpha", "transcript_plain_untagged"]);
});

test("library tags=... keeps rows whose tag list contains every supplied tag (AND semantics)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "filter-tags");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const singleTag = (await (await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?tags=alpha`)).json()) as LibraryApiResponse;
  expect(singleTag.items?.map((i) => i.id).sort()).toEqual(["transcript_imp_alpha", "transcript_plain_alpha"]);

  // Repeated `tags=` params intersect (the row must have all supplied tags).
  const intersectResponse = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?tags=alpha&tags=zulu`);
  const intersect = (await intersectResponse.json()) as LibraryApiResponse;
  expect(intersect.items?.map((i) => i.id)).toEqual(["transcript_imp_alpha"]);

  // A tag no row carries collapses to an empty list.
  const noHit = (await (await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?tags=gamma`)).json()) as LibraryApiResponse;
  expect(noHit.items).toEqual([]);
});

test("library tag filter is normalized (case-insensitive) to match stored lowercase tags", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "filter-tags-case");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const response = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?tags=ALPHA`);
  const body = (await response.json()) as LibraryApiResponse;
  expect(body.items?.map((i) => i.id).sort()).toEqual(["transcript_imp_alpha", "transcript_plain_alpha"]);
});

test("library rejects invalid important and tags inputs with invalid_query", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "filter-invalid");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const invalidImportant = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?important=maybe`);
  expect(invalidImportant.status()).toBe(400);
  expect(((await invalidImportant.json()) as { code?: string }).code).toBe("invalid_query");

  const overlongTag = "z".repeat(51);
  const invalidTag = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?tags=${encodeURIComponent(overlongTag)}`);
  expect(invalidTag.status()).toBe(400);
  expect(((await invalidTag.json()) as { code?: string }).code).toBe("invalid_query");
});

test("library cursor pagination survives across pages when sorting by important_first", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "cursor-imp");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const firstResponse = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?sort=important_first&limit=2`);
  const first = (await firstResponse.json()) as LibraryApiResponse;
  expect(first.items?.map((i) => i.id)).toEqual(["transcript_imp_beta", "transcript_imp_alpha"]);
  const cursor = requireCursor(first.nextCursor);

  const secondResponse = await page.request.get(
    `/api/workspaces/${user.workspaceSlug}/transcripts?sort=important_first&limit=2&cursor=${encodeURIComponent(cursor)}`,
  );
  const second = (await secondResponse.json()) as LibraryApiResponse;
  expect(second.items?.map((i) => i.id)).toEqual(["transcript_plain_untagged", "transcript_plain_alpha"]);
});

test("library cursor pagination survives across pages when sorting by tag_list_asc (including the untagged tail)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "cursor-tag");
  await seedTranscripts(request, { workspaceSlug: user.workspaceSlug, userEmail: user.email, transcripts: CURATION_FIXTURES });

  const firstResponse = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts?sort=tag_list_asc&limit=2`);
  const first = (await firstResponse.json()) as LibraryApiResponse;
  expect(first.items?.map((i) => i.id)).toEqual(["transcript_plain_alpha", "transcript_imp_alpha"]);
  const cursor = requireCursor(first.nextCursor);

  const secondResponse = await page.request.get(
    `/api/workspaces/${user.workspaceSlug}/transcripts?sort=tag_list_asc&limit=2&cursor=${encodeURIComponent(cursor)}`,
  );
  const second = (await secondResponse.json()) as LibraryApiResponse;
  expect(second.items?.map((i) => i.id)).toEqual(["transcript_imp_beta", "transcript_plain_untagged"]);
});

function requireCursor(value: string | null | undefined): string {
  expect(value, "expected paginated response to expose a non-null cursor").toBeTruthy();
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("expected non-empty cursor string");
  }
  return value;
}

// --- Task 4.3: Curation DELETE -------------------------------------

test("DELETE as the creator (member role) removes the record from library and detail surfaces", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "del-owner");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    membershipRole: "member",
    transcripts: [
      { id: "transcript_keep", title: "Keep me" },
      { id: "transcript_delete", title: "Delete me" },
    ],
  });

  const response = await page.request.delete(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_delete`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok: boolean; transcriptId?: string; workspaceId?: string };
  expect(body.ok).toBe(true);
  expect(body.transcriptId).toBe("transcript_delete");

  // Library no longer lists the deleted row.
  const library = (await (await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts`)).json()) as LibraryApiResponse;
  expect(library.items?.map((i) => i.id)).toEqual(["transcript_keep"]);

  // Detail fetch collapses to not_found.
  const detail = await page.request.get(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_delete`);
  expect(detail.status()).toBe(404);

  // A second DELETE is a no-op that returns not_found, confirming the
  // record is gone (and the retry is safe).
  const replay = await page.request.delete(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_delete`);
  expect(replay.status()).toBe(404);
  expect(((await replay.json()) as { code?: string }).code).toBe("not_found");
});

test("DELETE as admin works regardless of who created the transcript", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "del-admin");
  // Seed a transcript whose creator FK points at another (deleted)
  // user so this exercises the admin override even when the member
  // rules would refuse.
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    membershipRole: "admin",
    transcripts: [
      {
        id: "transcript_admin_del",
        title: "Admin delete",
        createdByUserEmail: null,
      },
    ],
  });

  const response = await page.request.delete(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_admin_del`);
  expect(response.status()).toBe(200);
});

test("DELETE as a member refuses when the creator attribution was cleared (deleted-creator fallback)", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "del-creator-cleared");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    membershipRole: "member",
    transcripts: [
      {
        id: "transcript_orphan",
        title: "Orphan transcript",
        createdByUserEmail: null,
      },
    ],
  });

  const response = await page.request.delete(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_orphan`);
  expect(response.status()).toBe(403);
  const body = (await response.json()) as { code?: string; message?: string };
  expect(body.code).toBe("forbidden");
  // The underlying refusal reason is surfaced in the message so the
  // UI can show the "admin only" copy when the creator is cleared.
  expect(body.message).toContain("creator_attribution_cleared");
});

test("DELETE as a member refuses when someone else created the transcript", async ({ browser, request }) => {
  // Create two accounts so Alice (admin) can seed a transcript
  // attributed to herself, then change her own role to read_only and
  // Bob's role to member so Bob (member) tries to delete Alice's
  // transcript.
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const alice = await signInFreshUser(alicePage, aliceContext.request, "del-alice-creator");

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  const bob = await signInFreshUser(bobPage, bobContext.request, "del-bob-member");

  // Seed a transcript in Bob's workspace that is attributed to Alice
  // so the creator id does not match Bob but the record is visible to
  // Bob. Bob is granted a `member` role on his own workspace.
  await seedTranscripts(request, {
    workspaceSlug: bob.workspaceSlug,
    userEmail: bob.email,
    membershipRole: "member",
    transcripts: [
      {
        id: "transcript_not_creator",
        title: "Alice's in Bob's workspace",
        createdByUserEmail: alice.email,
      },
    ],
  });

  const response = await bobPage.request.delete(`/api/workspaces/${bob.workspaceSlug}/transcripts/transcript_not_creator`);
  expect(response.status()).toBe(403);
  const body = (await response.json()) as { code?: string; message?: string };
  expect(body.code).toBe("forbidden");
  expect(body.message).toContain("not_creator");

  await aliceContext.close();
  await bobContext.close();
});

test("DELETE is always refused for read_only members, even when they are the creator", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "del-readonly");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    membershipRole: "read_only",
    transcripts: [{ id: "transcript_readonly_creator", title: "I made this but I'm read_only" }],
  });

  const response = await page.request.delete(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_readonly_creator`);
  expect(response.status()).toBe(403);
  const body = (await response.json()) as { code?: string; message?: string };
  expect(body.code).toBe("forbidden");
  expect(body.message).toContain("role_not_permitted");
});

test("DELETE locks out archived workspaces with workspace_archived", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "del-archived");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ id: "transcript_archived_del", title: "Alpha" }],
  });
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    archiveWorkspace: true,
    transcripts: [],
  });

  const response = await page.request.delete(`/api/workspaces/${user.workspaceSlug}/transcripts/transcript_archived_del`);
  expect(response.status()).toBe(409);
  expect(((await response.json()) as { code?: string }).code).toBe("workspace_archived");
});

test("DELETE cannot reach out-of-workspace records (404 rather than a cross-workspace leak)", async ({ browser, request }) => {
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const alice = await signInFreshUser(alicePage, aliceContext.request, "del-alice-xws");

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  const bob = await signInFreshUser(bobPage, bobContext.request, "del-bob-xws");

  await seedTranscripts(request, {
    workspaceSlug: alice.workspaceSlug,
    userEmail: alice.email,
    transcripts: [{ id: "transcript_alice_xws", title: "Alice's transcript" }],
  });

  const bobAtAlice = await bobPage.request.delete(`/api/workspaces/${alice.workspaceSlug}/transcripts/transcript_alice_xws`);
  expect(bobAtAlice.status()).toBe(404);

  const bobAtOwn = await bobPage.request.delete(`/api/workspaces/${bob.workspaceSlug}/transcripts/transcript_alice_xws`);
  expect(bobAtOwn.status()).toBe(404);
  expect(((await bobAtOwn.json()) as { code?: string }).code).toBe("not_found");

  await aliceContext.close();
  await bobContext.close();
});
