import { type APIRequestContext, type Download, expect, type Page, test } from "@playwright/test";

import { fetchWorkspacesForEmail, resetDatabase, signIn, signUpUser, verifyUser } from "./e2e/helpers";
import { seedTranscripts } from "./e2e/transcripts-helpers";

// End-to-end regression coverage for the
// `add-client-side-transcript-export` change. The spec (tasks 2.1,
// 3.1) requires exports on the authenticated detail view for every
// workspace role with read access, gated by `completed` status and
// refused in archived workspaces; public share pages must not expose
// export controls at all. The client-side conversion (md / txt / pdf
// / docx) happens in the browser, so the happy-path tests trigger an
// actual download and inspect the file produced by the live remark
// pipelines.

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
  const personalWorkspace = summary.workspaces.find((w) => w.workspaceType === "personal");
  if (!personalWorkspace) {
    throw new Error(`Expected personal workspace for ${email}`);
  }
  return {
    email,
    password,
    workspaceSlug: personalWorkspace.workspaceSlug,
    workspaceId: personalWorkspace.workspaceId,
  };
}

const COMPLETED_FIXTURE = {
  id: "transcript_export_sample",
  title: "Seeded transcript",
  customTitle: "Weekly Export Sync",
  recapMarkdown: "- Decision alpha\n- Decision beta",
  transcriptMarkdown: "Speaker 1: Hello, world.\nSpeaker 2: Hi there.",
} as const;

async function readDownloadBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readDownloadText(download: Download): Promise<string> {
  return (await readDownloadBytes(download)).toString("utf-8");
}

async function waitForDownload(page: Page): Promise<Download> {
  const event = await page.waitForEvent("download");
  return event as Download;
}

// --- Task 3.1: authorization + completed-only gating ---------------

for (const role of ["admin", "member", "read_only"] as const) {
  test(`every workspace role with read access (${role}) sees enabled export controls on a completed transcript`, async ({ page, request }) => {
    const user = await signInFreshUser(page, request, `export-${role}`);
    await seedTranscripts(request, {
      workspaceSlug: user.workspaceSlug,
      userEmail: user.email,
      membershipRole: role,
      transcripts: [COMPLETED_FIXTURE],
    });

    await page.goto(`/w/${user.workspaceSlug}/transcripts/${COMPLETED_FIXTURE.id}`);
    const panel = page.getByRole("region", { name: "Export transcript" });
    await expect(panel).toBeVisible();
    for (const format of ["md", "txt", "pdf", "docx"] as const) {
      const button = panel.locator(`[data-export-format="${format}"]`);
      await expect(button).toBeEnabled();
    }
    await expect(panel.getByText("Downloads become available once this transcript finishes processing.")).toHaveCount(0);
    await expect(panel.getByText("built in your browser")).toBeVisible();
  });
}

test("markdown download produces a title-derived filename and canonical heading order", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "export-md");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [COMPLETED_FIXTURE],
  });

  await page.goto(`/w/${user.workspaceSlug}/transcripts/${COMPLETED_FIXTURE.id}`);
  const panel = page.getByRole("region", { name: "Export transcript" });
  const downloadPromise = waitForDownload(page);
  await panel.locator('[data-export-format="md"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${COMPLETED_FIXTURE.customTitle}.md`);
  const text = await readDownloadText(download);
  // Heading order follows the canonical assembly contract: display
  // title -> recap -> transcript. The assembled document is the same
  // canonical markdown the public share page renders, just wrapped in
  // a file download on the authenticated side.
  const titleIdx = text.indexOf(`# ${COMPLETED_FIXTURE.customTitle}`);
  const recapIdx = text.indexOf("## Recap");
  const transcriptIdx = text.indexOf("## Transcript");
  expect(titleIdx).toBeGreaterThanOrEqual(0);
  expect(recapIdx).toBeGreaterThan(titleIdx);
  expect(transcriptIdx).toBeGreaterThan(recapIdx);
  expect(text).toContain("- Decision alpha");
  expect(text).toContain("Speaker 1: Hello, world.");
});

test("plain-text download flattens the canonical markdown to prose", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "export-txt");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [COMPLETED_FIXTURE],
  });

  await page.goto(`/w/${user.workspaceSlug}/transcripts/${COMPLETED_FIXTURE.id}`);
  const panel = page.getByRole("region", { name: "Export transcript" });
  const downloadPromise = waitForDownload(page);
  await panel.locator('[data-export-format="txt"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${COMPLETED_FIXTURE.customTitle}.txt`);
  const text = await readDownloadText(download);
  expect(text).not.toContain("## Recap");
  expect(text).not.toContain("# ");
  expect(text).toContain("Recap");
  expect(text).toContain("Transcript");
  expect(text).toContain("Decision alpha");
  expect(text).toContain("Speaker 1: Hello, world.");
});

test("pdf download emits a PDF file with the title-derived filename", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "export-pdf");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [COMPLETED_FIXTURE],
  });

  await page.goto(`/w/${user.workspaceSlug}/transcripts/${COMPLETED_FIXTURE.id}`);
  const panel = page.getByRole("region", { name: "Export transcript" });
  const downloadPromise = waitForDownload(page);
  await panel.locator('[data-export-format="pdf"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${COMPLETED_FIXTURE.customTitle}.pdf`);
  const bytes = await readDownloadBytes(download);
  // Every PDF starts with the `%PDF-` magic bytes; asserting on them
  // is the most stable cross-viewer proof that the client-side
  // `remark-pdf` compiler actually produced a PDF.
  expect(bytes.slice(0, 5).toString("ascii")).toBe("%PDF-");
});

test("docx download emits a Word file with the title-derived filename", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "export-docx");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [COMPLETED_FIXTURE],
  });

  await page.goto(`/w/${user.workspaceSlug}/transcripts/${COMPLETED_FIXTURE.id}`);
  const panel = page.getByRole("region", { name: "Export transcript" });
  const downloadPromise = waitForDownload(page);
  await panel.locator('[data-export-format="docx"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${COMPLETED_FIXTURE.customTitle}.docx`);
  const bytes = await readDownloadBytes(download);
  // DOCX is a ZIP container — the first four bytes are always
  // `PK\x03\x04`. Asserting on them confirms `remark-docx` produced a
  // Word document rather than falling through to some opaque
  // fallback.
  expect(bytes[0]).toBe(0x50);
  expect(bytes[1]).toBe(0x4b);
  expect(bytes[2]).toBe(0x03);
  expect(bytes[3]).toBe(0x04);
});

test("export controls are disabled with completion copy when the transcript is still processing", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "export-processing");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [{ ...COMPLETED_FIXTURE, id: "transcript_processing", status: "transcribing", completedAt: null }],
  });

  await page.goto(`/w/${user.workspaceSlug}/transcripts/transcript_processing`);
  const panel = page.getByRole("region", { name: "Export transcript" });
  await expect(panel).toBeVisible();
  for (const format of ["md", "txt", "pdf", "docx"] as const) {
    await expect(panel.locator(`[data-export-format="${format}"]`)).toBeDisabled();
  }
  await expect(panel.getByText("Downloads become available once this transcript finishes processing.")).toBeVisible();
});

test("export controls are disabled with failure copy when the transcript failed processing", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "export-failed");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [
      {
        ...COMPLETED_FIXTURE,
        id: "transcript_failed",
        status: "failed",
        completedAt: null,
        failureCode: "processing_failed",
        failureSummary: "Upstream TTS outage",
      },
    ],
  });

  await page.goto(`/w/${user.workspaceSlug}/transcripts/transcript_failed`);
  const panel = page.getByRole("region", { name: "Export transcript" });
  await expect(panel).toBeVisible();
  for (const format of ["md", "txt", "pdf", "docx"] as const) {
    await expect(panel.locator(`[data-export-format="${format}"]`)).toBeDisabled();
  }
  await expect(panel.getByText("Downloads are disabled for transcripts that failed processing.")).toBeVisible();
});

test("archived workspaces hide the detail view (and therefore the export panel) behind the archival notice", async ({ page, request }) => {
  const user = await signInFreshUser(page, request, "export-archived");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [COMPLETED_FIXTURE],
  });
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    archiveWorkspace: true,
    transcripts: [],
  });

  await page.goto(`/w/${user.workspaceSlug}/transcripts/${COMPLETED_FIXTURE.id}`);
  await expect(page.getByRole("heading", { name: "Workspace archived" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Export transcript" })).toHaveCount(0);
});

// --- Public share page must not surface export controls ------------

test("public share pages expose the canonical content without any export controls", async ({ browser, page, request }) => {
  const user = await signInFreshUser(page, request, "export-public");
  await seedTranscripts(request, {
    workspaceSlug: user.workspaceSlug,
    userEmail: user.email,
    transcripts: [COMPLETED_FIXTURE],
  });

  const shareResponse = await page.request.post(`/api/workspaces/${user.workspaceSlug}/transcripts/${COMPLETED_FIXTURE.id}/share`, {
    headers: { "content-type": "application/json" },
    data: { action: "enable" },
  });
  expect(shareResponse.status()).toBe(200);
  const shareBody = (await shareResponse.json()) as {
    ok: boolean;
    transcript?: { share: { isPubliclyShared: boolean; publicSharePath: string | null } };
  };
  expect(shareBody.ok).toBe(true);
  expect(shareBody.transcript?.share.isPubliclyShared).toBe(true);
  const publicSharePath = shareBody.transcript?.share.publicSharePath;
  expect(publicSharePath, "enable response must include the public share path").toBeTruthy();
  if (typeof publicSharePath !== "string" || publicSharePath.length === 0) {
    throw new Error("expected non-empty publicSharePath");
  }

  // Use a fresh, unauthenticated context so we reproduce the
  // experience of a visitor with nothing but the share link.
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(publicSharePath);
  await expect(anonymousPage.getByRole("heading", { name: COMPLETED_FIXTURE.customTitle })).toBeVisible();
  await expect(anonymousPage.getByRole("region", { name: "Export transcript" })).toHaveCount(0);
  for (const format of ["md", "txt", "pdf", "docx"] as const) {
    await expect(anonymousPage.locator(`[data-export-format="${format}"]`)).toHaveCount(0);
  }
  await anonymousContext.close();
});
