import { createHmac } from "node:crypto";

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
  // Verification auto-redirects to the dashboard because the sign-up session
  // is already in place; waiting on the URL is more reliable than the
  // success status, which may flash only briefly before navigation.
  await page.waitForURL("**/dashboard");
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// TOTP generation using Node's crypto for deterministic tests. We
// intentionally avoid pulling a third-party library here — the
// Better Auth plugin uses the standard RFC 6238 algorithm with 30-second
// step and 6 digits, and we can replicate that in ~20 lines.
export function generateTotp(secretBase32: string, periodSeconds = 30, digits = 6, at: Date = new Date()): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(at.getTime() / 1000 / periodSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const truncated = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
  return String(truncated % 10 ** digits).padStart(digits, "0");
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.replace(/=+$/u, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of cleaned) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

// Extracts the `secret` query parameter from the TOTP provisioning URI
// exposed by the 2FA settings page after `enable`. The URI follows the
// otpauth:// scheme standard used by every authenticator app.
export function extractTotpSecret(totpURI: string): string {
  const parsed = new URL(totpURI);
  const secret = parsed.searchParams.get("secret");
  if (!secret) {
    throw new Error(`Expected secret query param in ${totpURI}`);
  }
  return secret;
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
