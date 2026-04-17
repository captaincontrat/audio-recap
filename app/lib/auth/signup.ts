import "server-only";

import { getEmailAdapter } from "../server/email/factory";
import { getServerEnv } from "../server/env";
import { childLogger } from "../server/logger";
import { findUserByEmail } from "./accounts";
import { getAuth } from "./instance";
import { normalizeEmail } from "./normalize";
import { signUpInputSchema } from "./schemas";
import { issueEmailVerificationToken } from "./token-store";

export type SignUpSuccess = {
  ok: true;
  userId: string;
  sessionToken: string;
  verificationExpiresAt: Date;
};

type SignUpFailureCode = "invalid_input" | "email_already_used" | "sign_up_failed";

export type SignUpFailure = {
  ok: false;
  code: SignUpFailureCode;
  message: string;
};

export type SignUpResult = SignUpSuccess | SignUpFailure;

export type SignUpRequest = {
  email: string;
  password: string;
  name?: string;
};

// Delegated entry point for the `/api/auth/sign-up` route handler. Validates
// input, normalizes the email, creates the account through Better Auth, then
// issues a hashed verification token and sends the verification email. A
// verification-pending session is always created so the UI can redirect the
// visitor to the "check your inbox" screen right after the form submission,
// while still gating protected routes on `emailVerified`.
export async function signUpWithPassword(input: SignUpRequest): Promise<SignUpResult> {
  const log = childLogger({ component: "auth.sign-up" });

  const parsed = signUpInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      code: "invalid_input",
      message: first?.message ?? "Invalid sign-up input",
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;
  const name = parsed.data.name?.trim() ?? email;

  // Pre-flight duplicate check so we can surface the explicit
  // "email already used" response required by the spec. Racing sign-ups will
  // still collide at the unique-index layer below, which we translate back to
  // the same user-facing error.
  const existing = await findUserByEmail(email);
  if (existing) {
    log.info({ emailHash: hashForLog(email) }, "sign-up rejected: email already exists");
    return {
      ok: false,
      code: "email_already_used",
      message: "An account with this email already exists. Try signing in or resetting your password.",
    };
  }

  const auth = getAuth();
  let signUpOutcome: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    signUpOutcome = await auth.api.signUpEmail({
      body: { email, password, name },
      returnHeaders: false,
    });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return {
        ok: false,
        code: "email_already_used",
        message: "An account with this email already exists. Try signing in or resetting your password.",
      };
    }
    log.error({ err: error }, "Better Auth sign-up call failed");
    return {
      ok: false,
      code: "sign_up_failed",
      message: "We couldn't complete sign-up. Please try again in a moment.",
    };
  }

  const userId = signUpOutcome?.user?.id;
  const sessionToken = signUpOutcome?.token;
  if (!userId || !sessionToken) {
    log.error({ hasUser: Boolean(userId), hasToken: Boolean(sessionToken) }, "sign-up returned without session material");
    return {
      ok: false,
      code: "sign_up_failed",
      message: "We couldn't complete sign-up. Please try again in a moment.",
    };
  }

  const verification = await issueEmailVerificationToken({ userId });
  await sendVerificationEmail({
    to: email,
    userName: parsed.data.name?.trim() || undefined,
    token: verification.token,
  });

  log.info({ userId, emailHash: hashForLog(email) }, "sign-up succeeded; verification email issued");

  return {
    ok: true,
    userId,
    sessionToken,
    verificationExpiresAt: verification.expiresAt,
  };
}

export async function sendVerificationEmail(args: { to: string; userName?: string; token: string }): Promise<void> {
  const env = getServerEnv();
  const adapter = getEmailAdapter();
  const base = new URL(env.BETTER_AUTH_URL);
  base.pathname = "/auth/verify-email";
  base.searchParams.set("token", args.token);

  await adapter.send({
    type: "verification",
    to: args.to,
    url: base.toString(),
    userName: args.userName ?? null,
  });
}

function isDuplicateEmailError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; status?: number };
  if (err.code === "USER_ALREADY_EXISTS") return true;
  if (typeof err.message === "string" && /exists/i.test(err.message)) return true;
  return false;
}

// Hash the email with a stable, non-cryptographic transform for log fields so
// we don't leak plaintext addresses into structured logs.
function hashForLog(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return `e_${(hash >>> 0).toString(36)}`;
}
