import "server-only";

import { and, eq, isNull, lte } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { emailVerificationToken, passwordResetToken } from "../server/db/schema";
import { createTokenMaterial, hashToken } from "./token";

// Token time-to-live windows in milliseconds. These are chosen to keep the
// attack surface small while remaining usable over typical email latency:
// - Verification tokens live long enough to be retried once or twice.
// - Reset tokens expire quickly because they grant password change power.
const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

export type IssuedToken = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

type TokenConsumeOk = {
  ok: true;
  userId: string;
};

type TokenConsumeError = {
  ok: false;
  reason: "not_found" | "expired" | "already_used";
};

export type TokenConsumeResult = TokenConsumeOk | TokenConsumeError;

function computeExpiry(ttlMs: number, now: Date): Date {
  return new Date(now.getTime() + ttlMs);
}

// Email verification -----------------------------------------------------

export async function issueEmailVerificationToken({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<IssuedToken> {
  const material = createTokenMaterial();
  const expiresAt = computeExpiry(EMAIL_VERIFICATION_TTL_MS, now);
  await getDb().insert(emailVerificationToken).values({
    userId,
    tokenHash: material.hash,
    expiresAt,
    createdAt: now,
  });
  return { token: material.token, tokenHash: material.hash, expiresAt };
}

// Mark previously issued, still-active verification tokens as consumed so
// only the newest one is valid. Call this before `issueEmailVerificationToken`
// for resend flows.
export async function invalidateEmailVerificationTokensForUser({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<void> {
  await getDb()
    .update(emailVerificationToken)
    .set({ consumedAt: now })
    .where(and(eq(emailVerificationToken.userId, userId), isNull(emailVerificationToken.consumedAt)));
}

export async function consumeEmailVerificationToken({ token, now = new Date() }: { token: string; now?: Date }): Promise<TokenConsumeResult> {
  const tokenHash = hashToken(token);
  const db = getDb();
  const rows = await db
    .select({
      userId: emailVerificationToken.userId,
      expiresAt: emailVerificationToken.expiresAt,
      consumedAt: emailVerificationToken.consumedAt,
    })
    .from(emailVerificationToken)
    .where(eq(emailVerificationToken.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (row.consumedAt) {
    return { ok: false, reason: "already_used" };
  }
  if (row.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }
  await db.update(emailVerificationToken).set({ consumedAt: now }).where(eq(emailVerificationToken.tokenHash, tokenHash));
  return { ok: true, userId: row.userId };
}

// Password reset ---------------------------------------------------------

export async function issuePasswordResetToken({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<IssuedToken> {
  const material = createTokenMaterial();
  const expiresAt = computeExpiry(PASSWORD_RESET_TTL_MS, now);
  await getDb().insert(passwordResetToken).values({
    userId,
    tokenHash: material.hash,
    expiresAt,
    createdAt: now,
  });
  return { token: material.token, tokenHash: material.hash, expiresAt };
}

export async function invalidatePasswordResetTokensForUser({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<void> {
  await getDb()
    .update(passwordResetToken)
    .set({ consumedAt: now })
    .where(and(eq(passwordResetToken.userId, userId), isNull(passwordResetToken.consumedAt)));
}

export async function consumePasswordResetToken({ token, now = new Date() }: { token: string; now?: Date }): Promise<TokenConsumeResult> {
  const tokenHash = hashToken(token);
  const db = getDb();
  const rows = await db
    .select({
      userId: passwordResetToken.userId,
      expiresAt: passwordResetToken.expiresAt,
      consumedAt: passwordResetToken.consumedAt,
    })
    .from(passwordResetToken)
    .where(eq(passwordResetToken.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (row.consumedAt) {
    return { ok: false, reason: "already_used" };
  }
  if (row.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }
  await db.update(passwordResetToken).set({ consumedAt: now }).where(eq(passwordResetToken.tokenHash, tokenHash));
  return { ok: true, userId: row.userId };
}

// Maintenance ------------------------------------------------------------

// Purge tokens whose expiry has passed. Useful for a scheduled cleanup job so
// expired rows don't accumulate indefinitely. Returns the number of rows
// removed so operators can log the cleanup impact.
export async function purgeExpiredAuthTokens(now: Date = new Date()): Promise<{
  emailVerificationRemoved: number;
  passwordResetRemoved: number;
}> {
  const db = getDb();
  const deletedVerification = await db
    .delete(emailVerificationToken)
    .where(lte(emailVerificationToken.expiresAt, now))
    .returning({ tokenHash: emailVerificationToken.tokenHash });
  const deletedReset = await db.delete(passwordResetToken).where(lte(passwordResetToken.expiresAt, now)).returning({ tokenHash: passwordResetToken.tokenHash });
  return {
    emailVerificationRemoved: deletedVerification.length,
    passwordResetRemoved: deletedReset.length,
  };
}

export const __internals = {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
};
