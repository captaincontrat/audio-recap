import { type APIRequestContext, expect, type Page } from "@playwright/test";

import type { CapturedEmail } from "@/lib/server/email/memory";

export async function resetDatabase(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/test/reset");
  expect(response.ok(), `reset failed: ${response.status()} ${await response.text()}`).toBe(true);
  await response.dispose();
}

export async function fetchEmailsFor(request: APIRequestContext, to: string): Promise<CapturedEmail[]> {
  const response = await request.get(`/api/test/emails?to=${encodeURIComponent(to)}`);
  expect(response.ok(), `emails fetch failed: ${response.status()}`).toBe(true);
  const body = (await response.json()) as { ok: boolean; emails: CapturedEmail[] };
  await response.dispose();
  return body.emails;
}

export async function waitForEmail(request: APIRequestContext, to: string, type: CapturedEmail["type"], timeoutMs = 10_000): Promise<CapturedEmail> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;
  while (Date.now() < deadline) {
    const emails = await fetchEmailsFor(request, to);
    lastCount = emails.length;
    const match = emails.find((email) => email.type === type);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${type} email to ${to} (seen ${lastCount} email(s))`);
}

export function extractTokenFromUrl(url: string): string {
  const parsed = new URL(url);
  const token = parsed.searchParams.get("token");
  if (!token) {
    throw new Error(`Expected token query param in ${url}`);
  }
  return token;
}

export async function signUpUser(page: Page, email: string, password: string, name = "Test User"): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Name (optional)").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/verify-email**");
}

export async function verifyUser(request: APIRequestContext, page: Page, email: string): Promise<void> {
  const verification = await waitForEmail(request, email, "verification");
  const token = extractTokenFromUrl(verification.url);
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole("status")).toContainText("Your email is verified");
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export type TestWorkspaceEntry = {
  membershipId: string;
  role: "read_only" | "member" | "admin";
  lastAccessedAt: string | null;
  workspaceId: string;
  workspaceType: "personal" | "team";
  workspaceSlug: string;
  workspaceName: string;
  isPersonalOwner: boolean;
};

export type TestWorkspacesSummary = {
  ok: boolean;
  userId: string | null;
  workspaces: TestWorkspaceEntry[];
  personalOwned: number;
};

export async function fetchWorkspacesForEmail(request: APIRequestContext, email: string): Promise<TestWorkspacesSummary> {
  const response = await request.get(`/api/test/workspaces?email=${encodeURIComponent(email)}`);
  expect(response.ok(), `workspaces fetch failed: ${response.status()} ${await response.text()}`).toBe(true);
  const body = (await response.json()) as TestWorkspacesSummary;
  await response.dispose();
  return body;
}
