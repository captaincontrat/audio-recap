import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { account, passkey, session, user } from "../server/db/schema";
import { normalizeEmail, normalizeEmailOrThrow } from "./normalize";
import { hashPassword } from "./password";

// Provider identifiers used by Better Auth and its plugins. Centralizing
// them here keeps the account repository the single source of truth for
// what a "linked credential" can look like.
export const CREDENTIAL_PROVIDER_ID = "credential" as const;
export const GOOGLE_PROVIDER_ID = "google" as const;

export type LinkedCredentialSummary = {
  providerId: string;
  accountId: string;
  createdAt: Date;
};

export type EnrolledPasskeySummary = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date | null;
};

export type AccountUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

function toAccountUser(row: { id: string; email: string; name: string; emailVerified: boolean }): AccountUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
  };
}

// Look up a user by raw (un-normalized) email input. Returns `null` if no
// account exists so callers can implement neutral responses for flows like
// "forgot password" without branching on DB errors.
export async function findUserByEmail(email: string): Promise<AccountUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }
  const rows = await getDb()
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);
  const row = rows[0];
  return row ? toAccountUser(row) : null;
}

export async function findUserById(userId: string): Promise<AccountUser | null> {
  const rows = await getDb()
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const row = rows[0];
  return row ? toAccountUser(row) : null;
}

// Mark an account's email as verified. Idempotent — calling on an already
// verified user is a no-op.
export async function markEmailVerified(userId: string): Promise<void> {
  await getDb().update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.id, userId));
}

// Replace the password on every credentials account owned by the user. This
// is used by the password-reset flow: the spec requires the new password to
// apply across the user's credentials regardless of how many account rows
// might exist.
export async function replaceCredentialsPassword({ userId, newPassword }: { userId: string; newPassword: string }): Promise<void> {
  const hashed = await hashPassword(newPassword);
  await getDb()
    .update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
}

export type SessionRevocationOptions = {
  userId: string;
  /**
   * Session id to keep (e.g. the session that just performed the action).
   * When omitted, every session for the user is revoked.
   */
  keepSessionId?: string;
};

// Delete rows from the `session` table. Better Auth stores live sessions as
// rows, so removing them effectively signs the user out everywhere. Used by
// the password-reset flow.
export async function revokeSessionsForUser(options: SessionRevocationOptions): Promise<number> {
  const { userId, keepSessionId } = options;
  const db = getDb();
  const condition = keepSessionId === undefined ? eq(session.userId, userId) : and(eq(session.userId, userId), ne(session.id, keepSessionId));
  const deleted = await db.delete(session).where(condition).returning({ id: session.id });
  return deleted.length;
}

// Internal helper reused by tests and the sign-up flow to make sure emails
// land in storage in their canonical form without throwing silently. Returns
// the normalized email when valid, otherwise throws.
export function normalizeUserEmailOrThrow(email: string): string {
  return normalizeEmailOrThrow(email);
}

// List every Better Auth account row linked to a user (password, Google,
// and any future OAuth provider). Used by the account-settings UI to show
// "connected methods" and by the passkey-enrollment flow when it needs to
// know whether a user already has a primary credential.
export async function listLinkedAccountsForUser(userId: string): Promise<LinkedCredentialSummary[]> {
  const rows = await getDb()
    .select({
      providerId: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
    })
    .from(account)
    .where(eq(account.userId, userId));

  return rows.map((row) => ({
    providerId: row.providerId,
    accountId: row.accountId,
    createdAt: row.createdAt,
  }));
}

// Passkeys live in their own table rather than under `account`; this helper
// surfaces the metadata the enrollment UI needs (name, device type, backup
// status, created-at) without leaking the stored public key.
export async function listEnrolledPasskeysForUser(userId: string): Promise<EnrolledPasskeySummary[]> {
  const rows = await getDb()
    .select({
      id: passkey.id,
      name: passkey.name,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
      createdAt: passkey.createdAt,
    })
    .from(passkey)
    .where(eq(passkey.userId, userId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    createdAt: row.createdAt,
  }));
}

// Look up an existing user by the normalized form of the supplied email,
// used by the Google and magic-link linking paths as a safety net before
// they hand the account resolution back to Better Auth. Encapsulating the
// normalization here keeps the "one account per normalized email" rule in
// lockstep with the unique index on `user.email`.
export async function findUserByNormalizedEmail(email: string): Promise<AccountUser | null> {
  return findUserByEmail(email);
}
