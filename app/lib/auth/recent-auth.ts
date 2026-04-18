import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { session as sessionTable } from "../server/db/schema";
import { RECENT_AUTH_MAX_AGE_SECONDS } from "./two-factor-config";

export type RecentAuthResult = { ok: true } | { ok: false; reason: "missing-session" | "no-marker" | "stale" };

// Returns whether the given session has a recent full-authentication
// marker. "Recent" is bounded by `RECENT_AUTH_MAX_AGE_SECONDS`; the
// marker is stamped by the session.create database hook on every real
// authentication event (password sign-in, magic-link, OAuth callback,
// 2FA challenge completion).
//
// Sensitive auth-management endpoints call this and, on `ok: false`,
// redirect the user to `/account/recent-auth` to re-verify before they
// can continue. Keeping this behavior in one helper ensures every
// server action enforces the same window and returns the same shape
// back to the UI.
export async function verifyRecentAuth(sessionId: string | null | undefined): Promise<RecentAuthResult> {
  if (!sessionId) {
    return { ok: false, reason: "missing-session" };
  }

  const db = getDb();
  const row = await db.select({ lastAuthenticatedAt: sessionTable.lastAuthenticatedAt }).from(sessionTable).where(eq(sessionTable.id, sessionId)).limit(1);

  const marker = row[0]?.lastAuthenticatedAt;
  if (!marker) {
    return { ok: false, reason: "no-marker" };
  }

  const ageSeconds = (Date.now() - marker.getTime()) / 1000;
  if (ageSeconds > RECENT_AUTH_MAX_AGE_SECONDS) {
    return { ok: false, reason: "stale" };
  }

  return { ok: true };
}

// Force the marker forward without creating a new session. Used after a
// successful recent-auth re-verification prompt so the elevation window
// restarts from "now" on the same session row. We avoid rotating the
// session cookie here because the user did not sign in again — they only
// proved they still hold the credential.
export async function markRecentAuth(sessionId: string): Promise<void> {
  const db = getDb();
  await db.update(sessionTable).set({ lastAuthenticatedAt: new Date() }).where(eq(sessionTable.id, sessionId));
}
