import "server-only";

import { childLogger } from "../server/logger";
import { findUserById, markEmailVerified } from "./accounts";
import { sendVerificationEmail } from "./signup";
import { consumeEmailVerificationToken, invalidateEmailVerificationTokensForUser, issueEmailVerificationToken } from "./token-store";

export type ConsumeVerificationSuccess = {
  ok: true;
  userId: string;
  email: string;
  alreadyVerified: boolean;
};

export type ConsumeVerificationFailure = {
  ok: false;
  code: "invalid_token" | "token_expired" | "token_already_used" | "user_missing";
  message: string;
};

export type ConsumeVerificationResult = ConsumeVerificationSuccess | ConsumeVerificationFailure;

// Consume a single-use, hashed verification token. On success, flags the
// account as verified so protected routes can begin admitting it. Errors are
// distinguished so the UI can surface "expired" / "already used" nudges
// rather than a single opaque failure.
export async function consumeEmailVerification({ token, now = new Date() }: { token: string; now?: Date }): Promise<ConsumeVerificationResult> {
  const log = childLogger({ component: "auth.verify-email" });
  const outcome = await consumeEmailVerificationToken({ token, now });
  if (!outcome.ok) {
    log.info({ reason: outcome.reason }, "verification token rejected");
    return mapTokenFailure(outcome.reason);
  }

  const user = await findUserById(outcome.userId);
  if (!user) {
    log.warn({ userId: outcome.userId }, "verification token references missing user");
    return {
      ok: false,
      code: "user_missing",
      message: "This verification link is no longer valid.",
    };
  }

  if (user.emailVerified) {
    log.debug({ userId: user.id }, "verification token consumed for already-verified user");
    return { ok: true, userId: user.id, email: user.email, alreadyVerified: true };
  }

  await markEmailVerified(user.id);
  log.info({ userId: user.id }, "email verified");

  return { ok: true, userId: user.id, email: user.email, alreadyVerified: false };
}

function mapTokenFailure(reason: "not_found" | "expired" | "already_used"): ConsumeVerificationFailure {
  switch (reason) {
    case "not_found":
      return { ok: false, code: "invalid_token", message: "This verification link is not valid." };
    case "expired":
      return { ok: false, code: "token_expired", message: "This verification link has expired. Please request a new one." };
    case "already_used":
      return { ok: false, code: "token_already_used", message: "This verification link was already used." };
  }
}

export type ResendVerificationSuccess = {
  ok: true;
  expiresAt: Date;
};

export type ResendVerificationFailure = {
  ok: false;
  code: "user_missing" | "already_verified";
  message: string;
};

export type ResendVerificationResult = ResendVerificationSuccess | ResendVerificationFailure;

// Re-issue a verification email for an authenticated but unverified user.
// The previous live tokens are invalidated so only the most recent link
// works, honoring the "single-use" intent of the spec while still tolerating
// the user clicking "resend" several times.
export async function resendEmailVerification({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<ResendVerificationResult> {
  const log = childLogger({ component: "auth.resend-verification" });
  const user = await findUserById(userId);
  if (!user) {
    log.warn({ userId }, "resend request for missing user");
    return { ok: false, code: "user_missing", message: "Account not found." };
  }
  if (user.emailVerified) {
    log.debug({ userId }, "resend request ignored: account already verified");
    return { ok: false, code: "already_verified", message: "Your email is already verified." };
  }

  await invalidateEmailVerificationTokensForUser({ userId, now });
  const material = await issueEmailVerificationToken({ userId, now });
  await sendVerificationEmail({ to: user.email, userName: user.name || undefined, token: material.token });

  log.info({ userId }, "verification email re-issued");
  return { ok: true, expiresAt: material.expiresAt };
}
