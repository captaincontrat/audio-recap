import "server-only";

import { childLogger } from "../server/logger";
import { getAuth } from "./instance";
import { normalizeEmail } from "./normalize";
import { signInInputSchema } from "./schemas";

export type SignInSuccess = {
  ok: true;
  userId: string;
  sessionToken: string;
  emailVerified: boolean;
};

export type SignInTwoFactorRequired = {
  ok: true;
  twoFactorRequired: true;
  twoFactorMethods: readonly string[];
};

// Generic message required by the spec: never reveal whether the failure was
// a missing account vs an incorrect password.
const GENERIC_AUTH_FAILURE = "Email or password is incorrect.";

export type SignInFailure = {
  ok: false;
  code: "invalid_input" | "invalid_credentials";
  message: string;
};

export type SignInResult = SignInSuccess | SignInTwoFactorRequired | SignInFailure;

export async function signInWithPassword(input: { email: string; password: string }): Promise<SignInResult> {
  const log = childLogger({ component: "auth.sign-in" });

  const parsed = signInInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please enter a valid email and password.",
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  const auth = getAuth();
  try {
    const outcome = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: false,
    });
    // Better Auth's `twoFactor` plugin intercepts the sign-in response
    // when the user has 2FA enabled: no session token is issued and a
    // short-lived 2FA cookie is set instead. The client must redirect
    // to the challenge page. We collapse both TOTP and email-OTP cases
    // into a single `twoFactorRequired: true` signal — the challenge
    // UI inspects `twoFactorMethods` to decide which entry point to
    // render first.
    const twoFactorRedirect = (outcome as { twoFactorRedirect?: boolean } | undefined)?.twoFactorRedirect;
    if (twoFactorRedirect) {
      const methods = (outcome as { twoFactorMethods?: string[] } | undefined)?.twoFactorMethods ?? [];
      return {
        ok: true,
        twoFactorRequired: true,
        twoFactorMethods: methods,
      };
    }

    const userId = outcome?.user?.id;
    const sessionToken = outcome?.token;
    if (!userId || !sessionToken) {
      log.warn("sign-in completed but returned no session token");
      return { ok: false, code: "invalid_credentials", message: GENERIC_AUTH_FAILURE };
    }
    return {
      ok: true,
      userId,
      sessionToken,
      emailVerified: Boolean(outcome?.user?.emailVerified),
    };
  } catch (error) {
    // Better Auth raises thrown errors for invalid credentials. We collapse
    // every failure mode into one neutral response so enumeration attacks
    // can't infer whether an email exists.
    log.info({ err: describeError(error) }, "sign-in failed");
    return { ok: false, code: "invalid_credentials", message: GENERIC_AUTH_FAILURE };
  }
}

function describeError(error: unknown): { code?: string; status?: number; name?: string } {
  if (!error || typeof error !== "object") return {};
  const err = error as { code?: string; status?: number; name?: string };
  return { code: err.code, status: err.status, name: err.name };
}
