import { expect, test } from "@playwright/test";

import { fetchWorkspacesForEmail, resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";
import { type LibraryApiResponse, type SeedTranscriptSpec, seedTranscripts } from "./e2e/transcripts-helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

function requireString(value: string | null | undefined, message: string): string {
  expect(value, message).toBeTruthy();
  if (typeof value !== "string") {
    throw new Error(message);
  }
  return value;
}

async function setupUserWithTranscripts(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  suffix: string,
  transcripts: SeedTranscriptSpec[],
) {
  const email = `${suffix}-${Date.now()}@example.com`;
  const password = "super-secret-pass-1234";
  await signUpUser(page, email, password);
  await verifyUser(request, page, email);
  await signIn(page, email, password);
  await page.waitForURL(/\/w\//);
  const summary = await fetchWorkspacesForEmail(request, email);
  const personalWorkspace = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personalWorkspace) {
    throw new Error(`Expected personal workspace for ${email}`);
  }
  const slug = personalWorkspace.workspaceSlug;
  await seedTranscripts(request, { workspaceSlug: slug, userEmail: email, transcripts });
  return { email, slug };
}

const LIBRARY_FIXTURES: SeedTranscriptSpec[] = [
  {
    id: "transcript_2026_04_01",
    title: "Alpha weekly sync",
    transcriptMarkdown: "# Transcript\n\nDiscussing the roadmap.",
    recapMarkdown: "## Recap\n\n- Roadmap approved",
    status: "completed",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
  },
  {
    id: "transcript_2026_04_05",
    title: "Beta retro",
    transcriptMarkdown: "# Transcript\n\nRetro discussion.",
    recapMarkdown: "## Recap\n\n- Retro action items",
    status: "completed",
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-04-20T10:00:00.000Z",
  },
  {
    id: "transcript_2026_04_10",
    title: "Gamma onboarding",
    transcriptMarkdown: "# Transcript\n\nOnboarding new hire.",
    recapMarkdown: "## Recap\n\n- Onboarding plan",
    status: "failed",
    failureCode: "processing_failed",
    failureSummary: "Processing failed",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
  },
];

test("library search matches against titles and markdown content", async ({ page, request }) => {
  const user = await setupUserWithTranscripts(page, request, "search", LIBRARY_FIXTURES);

  const roadmapResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?search=roadmap`);
  expect(roadmapResponse.status()).toBe(200);
  const roadmap = (await roadmapResponse.json()) as LibraryApiResponse;
  expect(roadmap.items?.map((i) => i.id)).toEqual(["transcript_2026_04_01"]);

  const retroResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?search=retro`);
  const retro = (await retroResponse.json()) as LibraryApiResponse;
  expect(retro.items?.map((i) => i.id)).toEqual(["transcript_2026_04_05"]);

  const titleResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?search=Alpha`);
  const title = (await titleResponse.json()) as LibraryApiResponse;
  expect(title.items?.map((i) => i.id)).toEqual(["transcript_2026_04_01"]);

  const emptyResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?search=zzzzzno_match_zzzz`);
  const empty = (await emptyResponse.json()) as LibraryApiResponse;
  expect(empty.items).toEqual([]);
  expect(empty.nextCursor).toBeNull();
});

test("library search treats %/_ as literal characters (no wildcard injection)", async ({ page, request }) => {
  const user = await setupUserWithTranscripts(page, request, "search-escape", [
    { id: "transcript_plain", title: "Weekly 50 percent update" },
    { id: "transcript_literal", title: "Reviewed 50% milestone" },
  ]);

  const percentResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?search=${encodeURIComponent("50%")}`);
  const percentBody = (await percentResponse.json()) as LibraryApiResponse;
  expect(percentBody.items?.map((i) => i.id)).toEqual(["transcript_literal"]);
});

test("library supports newest_first, oldest_first, and recently_updated sorts", async ({ page, request }) => {
  const user = await setupUserWithTranscripts(page, request, "time-sort", LIBRARY_FIXTURES);

  const newest = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?sort=newest_first`)).json()) as LibraryApiResponse;
  expect(newest.items?.map((i) => i.id)).toEqual(["transcript_2026_04_10", "transcript_2026_04_05", "transcript_2026_04_01"]);

  const oldest = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?sort=oldest_first`)).json()) as LibraryApiResponse;
  expect(oldest.items?.map((i) => i.id)).toEqual(["transcript_2026_04_01", "transcript_2026_04_05", "transcript_2026_04_10"]);

  const recentlyUpdated = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?sort=recently_updated`)).json()) as LibraryApiResponse;
  expect(recentlyUpdated.items?.map((i) => i.id)).toEqual(["transcript_2026_04_05", "transcript_2026_04_10", "transcript_2026_04_01"]);
});

test("library supports title_asc and title_desc sorts (case-insensitive)", async ({ page, request }) => {
  const user = await setupUserWithTranscripts(page, request, "title-sort", [
    { id: "transcript_mixed_case", title: "bravo item" },
    { id: "transcript_upper", title: "ALPHA PICK" },
    { id: "transcript_lower", title: "charlie note" },
  ]);

  const asc = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?sort=title_asc`)).json()) as LibraryApiResponse;
  expect(asc.items?.map((i) => i.id)).toEqual(["transcript_upper", "transcript_mixed_case", "transcript_lower"]);

  const desc = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?sort=title_desc`)).json()) as LibraryApiResponse;
  expect(desc.items?.map((i) => i.id)).toEqual(["transcript_lower", "transcript_mixed_case", "transcript_upper"]);
});

test("library status filter returns only matching rows", async ({ page, request }) => {
  const user = await setupUserWithTranscripts(page, request, "status-filter", LIBRARY_FIXTURES);

  const completed = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?status=completed`)).json()) as LibraryApiResponse;
  expect(completed.items?.map((i) => i.id).sort()).toEqual(["transcript_2026_04_01", "transcript_2026_04_05"]);

  const failed = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?status=failed`)).json()) as LibraryApiResponse;
  expect(failed.items?.map((i) => i.id)).toEqual(["transcript_2026_04_10"]);

  const queued = (await (await page.request.get(`/api/workspaces/${user.slug}/transcripts?status=queued`)).json()) as LibraryApiResponse;
  expect(queued.items).toEqual([]);
});

test("library paginates with keyset cursor and preserves sort order across pages", async ({ page, request }) => {
  const seed: SeedTranscriptSpec[] = Array.from({ length: 7 }, (_, index) => ({
    id: `transcript_page_${String(index).padStart(2, "0")}`,
    title: `Row ${String.fromCharCode(65 + index)}`,
    createdAt: new Date(Date.UTC(2026, 3, index + 1, 12, 0, 0)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 3, index + 1, 12, 0, 0)).toISOString(),
  }));
  const user = await setupUserWithTranscripts(page, request, "pagination", seed);

  const firstResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?limit=3&sort=newest_first`);
  const first = (await firstResponse.json()) as LibraryApiResponse;
  expect(firstResponse.status()).toBe(200);
  expect(first.items?.map((i) => i.id)).toEqual(["transcript_page_06", "transcript_page_05", "transcript_page_04"]);
  const firstCursor = requireString(first.nextCursor, "first page should expose a nextCursor");
  expect(first.pageSize).toBe(3);

  const secondResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?limit=3&sort=newest_first&cursor=${encodeURIComponent(firstCursor)}`);
  const second = (await secondResponse.json()) as LibraryApiResponse;
  expect(second.items?.map((i) => i.id)).toEqual(["transcript_page_03", "transcript_page_02", "transcript_page_01"]);
  const secondCursor = requireString(second.nextCursor, "second page should expose a nextCursor");

  const thirdResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?limit=3&sort=newest_first&cursor=${encodeURIComponent(secondCursor)}`);
  const third = (await thirdResponse.json()) as LibraryApiResponse;
  expect(third.items?.map((i) => i.id)).toEqual(["transcript_page_00"]);
  expect(third.nextCursor).toBeNull();
});

test("library rejects a cursor that does not match the active sort", async ({ page, request }) => {
  const user = await setupUserWithTranscripts(page, request, "cursor-mismatch", LIBRARY_FIXTURES);

  const firstResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?limit=1&sort=newest_first`);
  const first = (await firstResponse.json()) as LibraryApiResponse;
  const cursor = requireString(first.nextCursor, "first page should expose a nextCursor");

  const mismatchResponse = await page.request.get(`/api/workspaces/${user.slug}/transcripts?limit=1&sort=title_asc&cursor=${encodeURIComponent(cursor)}`);
  expect(mismatchResponse.status()).toBe(400);
  const body = (await mismatchResponse.json()) as LibraryApiResponse;
  expect(body.code).toBe("invalid_query");
});

test("library rejects invalid sort, status, and limit inputs with 400", async ({ page, request }) => {
  const user = await setupUserWithTranscripts(page, request, "invalid-query", LIBRARY_FIXTURES);

  const invalidSort = await page.request.get(`/api/workspaces/${user.slug}/transcripts?sort=alphabetical`);
  expect(invalidSort.status()).toBe(400);
  expect(((await invalidSort.json()) as LibraryApiResponse).code).toBe("invalid_query");

  const invalidStatus = await page.request.get(`/api/workspaces/${user.slug}/transcripts?status=not_a_status`);
  expect(invalidStatus.status()).toBe(400);
  expect(((await invalidStatus.json()) as LibraryApiResponse).code).toBe("invalid_query");

  const invalidLimit = await page.request.get(`/api/workspaces/${user.slug}/transcripts?limit=0`);
  expect(invalidLimit.status()).toBe(400);

  const overMaxLimit = await page.request.get(`/api/workspaces/${user.slug}/transcripts?limit=999`);
  expect(overMaxLimit.status()).toBe(400);
});
