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

// Generic message required by the spec: never reveal whether the failure was
// a missing account vs an incorrect password.
const GENERIC_AUTH_FAILURE = "Email or password is incorrect.";

export type SignInFailure = {
  ok: false;
  code: "invalid_input" | "invalid_credentials";
  message: string;
};

export type SignInResult = SignInSuccess | SignInFailure;

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
