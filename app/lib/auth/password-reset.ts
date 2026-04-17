import "server-only";

import { getEmailAdapter } from "../server/email/factory";
import { getServerEnv } from "../server/env";
import { childLogger } from "../server/logger";
import { findUserByEmail, findUserById, replaceCredentialsPassword, revokeSessionsForUser } from "./accounts";
import { normalizeEmail } from "./normalize";
import { forgotPasswordInputSchema, resetPasswordInputSchema } from "./schemas";
import { consumePasswordResetToken, invalidatePasswordResetTokensForUser, issuePasswordResetToken } from "./token-store";

export type ForgotPasswordResult = {
  ok: true;
  // The neutral response the UI displays regardless of whether a matching
  // account exists. Kept on the result object so callers don't hand-craft
  // response text and accidentally diverge per branch.
  message: string;
};

// Always returns the same successful result, even when no account exists, so
// the network response does not leak whether an email is registered.
export async function requestPasswordReset(input: { email: string }): Promise<ForgotPasswordResult> {
  const log = childLogger({ component: "auth.forgot-password" });
  const neutralResponse: ForgotPasswordResult = {
    ok: true,
    message: "If an account exists for that address, you'll receive a password reset email shortly.",
  };

  const parsed = forgotPasswordInputSchema.safeParse(input);
  if (!parsed.success) {
    // Returning the same neutral message for malformed input keeps the
    // timing + response shape identical to the valid-email branch below.
    return neutralResponse;
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await findUserByEmail(email);
  if (!user) {
    log.info("forgot-password: no matching account");
    return neutralResponse;
  }

  await invalidatePasswordResetTokensForUser({ userId: user.id });
  const material = await issuePasswordResetToken({ userId: user.id });
  await sendPasswordResetEmail({
    to: user.email,
    userName: user.name || undefined,
    token: material.token,
  });

  log.info({ userId: user.id }, "forgot-password: reset email dispatched");
  return neutralResponse;
}

export type CompleteResetSuccess = {
  ok: true;
  userId: string;
};

export type CompleteResetFailure = {
  ok: false;
  code: "invalid_input" | "invalid_token" | "token_expired" | "token_already_used" | "user_missing";
  message: string;
};

export type CompleteResetResult = CompleteResetSuccess | CompleteResetFailure;

export type CompleteResetRequest = {
  token: string;
  password: string;
  /**
   * Session id to keep alive after the reset (typically the session that
   * completed the reset form). When omitted, every session is revoked so the
   * user must sign in again on every device.
   */
  keepSessionId?: string;
};

// Consume a hashed reset token, rotate the password to its Argon2id hash,
// invalidate any other live reset tokens for that user, and revoke sessions
// that weren't used to complete the reset. The spec requires all four side
// effects to happen on success.
export async function completePasswordReset({
  token,
  password,
  keepSessionId,
  now = new Date(),
}: CompleteResetRequest & { now?: Date }): Promise<CompleteResetResult> {
  const log = childLogger({ component: "auth.reset-password" });

  const parsed = resetPasswordInputSchema.safeParse({ token, password });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, code: "invalid_input", message: first?.message ?? "Invalid reset input" };
  }

  const consumed = await consumePasswordResetToken({ token: parsed.data.token, now });
  if (!consumed.ok) {
    log.info({ reason: consumed.reason }, "reset token rejected");
    return mapConsumeFailure(consumed.reason);
  }

  const user = await findUserById(consumed.userId);
  if (!user) {
    log.warn({ userId: consumed.userId }, "reset token references missing user");
    return { ok: false, code: "user_missing", message: "This reset link is no longer valid." };
  }

  await replaceCredentialsPassword({ userId: user.id, newPassword: parsed.data.password });
  await invalidatePasswordResetTokensForUser({ userId: user.id, now });
  const removed = await revokeSessionsForUser({ userId: user.id, keepSessionId });
  log.info({ userId: user.id, revokedSessions: removed }, "password reset completed");

  return { ok: true, userId: user.id };
}

function mapConsumeFailure(reason: "not_found" | "expired" | "already_used"): CompleteResetFailure {
  switch (reason) {
    case "not_found":
      return { ok: false, code: "invalid_token", message: "This reset link is not valid." };
    case "expired":
      return { ok: false, code: "token_expired", message: "This reset link has expired. Please request a new one." };
    case "already_used":
      return { ok: false, code: "token_already_used", message: "This reset link was already used." };
  }
}

async function sendPasswordResetEmail(args: { to: string; userName?: string; token: string }): Promise<void> {
  const env = getServerEnv();
  const adapter = getEmailAdapter();
  const base = new URL(env.BETTER_AUTH_URL);
  base.pathname = "/auth/reset-password";
  base.searchParams.set("token", args.token);

  await adapter.send({
    type: "password-reset",
    to: args.to,
    url: base.toString(),
    userName: args.userName ?? null,
  });
}
