import "server-only";

import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "../server/db/client";
import { account, session, user, verification } from "../server/db/schema";
import { getServerEnv } from "../server/env";
import { SESSION_COOKIE_NAME } from "./cookies";
import { normalizeEmail } from "./normalize";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";

// Seven-day session with a one-day sliding update window. Matches the design
// decision that sessions are server-owned and rotated on sign-out.
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

let cachedAuth: ReturnType<typeof buildAuth> | null = null;

function buildAuth() {
  const env = getServerEnv();
  const isProduction = env.NODE_ENV === "production";

  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      // Email verification is delivered via the application-owned token
      // pipeline (see `token-store.ts`), so Better Auth does not gate sign-in
      // on `emailVerified`. Protected routes enforce verification at the
      // application layer instead.
      requireEmailVerification: false,
      password: {
        hash: (plainText) => hashPassword(plainText),
        verify: ({ password, hash }) => verifyPassword(password, hash),
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    databaseHooks: {
      user: {
        // Safety net: even if a caller forgets to normalize before hitting
        // Better Auth, this hook guarantees the stored email is always the
        // normalized form, which is what the unique index protects.
        create: {
          before: async (userData) => ({
            data: {
              ...userData,
              email: normalizeEmail(userData.email),
            },
          }),
        },
        update: {
          before: async (userData) => {
            if (typeof userData.email === "string") {
              return {
                data: {
                  ...userData,
                  email: normalizeEmail(userData.email),
                },
              };
            }
            return { data: userData };
          },
        },
      },
    },
    advanced: {
      database: {
        generateId: () => randomUUID(),
      },
      cookies: {
        session_token: {
          name: SESSION_COOKIE_NAME,
          attributes: {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
          },
        },
      },
    },
  });
}

export function getAuth() {
  if (!cachedAuth) {
    cachedAuth = buildAuth();
  }
  return cachedAuth;
}

export function resetAuthForTests() {
  cachedAuth = null;
}

export type AppAuth = ReturnType<typeof buildAuth>;
