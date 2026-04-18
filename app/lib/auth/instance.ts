import "server-only";

import { randomUUID } from "node:crypto";
import { passkey as passkeyPlugin } from "@better-auth/passkey";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { lastLoginMethod, magicLink, oneTap } from "better-auth/plugins";
import { getDb } from "../server/db/client";
import { account, passkey, session, user, verification } from "../server/db/schema";
import { getServerEnv } from "../server/env";
import { childLogger } from "../server/logger";
import { ensurePersonalWorkspace } from "../server/workspaces/personal";
import { SESSION_COOKIE_NAME } from "./cookies";
import { sendMagicLinkEmail } from "./magic-link";
import { normalizeEmail } from "./normalize";
import { assertGoogleProfileVerified, assertOAuthCreationVerified } from "./oauth-linking";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";

// Seven-day session with a one-day sliding update window. Matches the design
// decision that sessions are server-owned and rotated on sign-out.
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

let cachedAuth: ReturnType<typeof buildAuth> | null = null;

function buildAuth() {
  const env = getServerEnv();
  const isProduction = env.NODE_ENV === "production";

  // Google OAuth + One Tap are both gated on the presence of a client-id/
  // client-secret pair. This keeps the plugin registry identical across
  // environments (so endpoint surfaces don't drift) while deferring actual
  // Google calls until the deployment has been provisioned with credentials.
  const googleClientId = env.GOOGLE_CLIENT_ID;
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET;
  const hasGoogleCredentials =
    typeof googleClientId === "string" && googleClientId.length > 0 && typeof googleClientSecret === "string" && googleClientSecret.length > 0;

  const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = hasGoogleCredentials
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          // Enforce the spec rule "create or link only when Google returns
          // a verified email" at the earliest point in the pipeline.
          // Better Auth's default account-linking logic already gates
          // linking on `emailVerified` (because we exclude Google from
          // `trustedProviders` below), but creation of brand-new users is
          // not gated by default — hence this explicit guard. Throwing
          // surfaces as a redirect to the error callback URL, which the
          // UI already knows how to render.
          mapProfileToUser: (profile) => {
            assertGoogleProfileVerified(profile);
            return {};
          },
        },
      }
    : {};

  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification, passkey },
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
    socialProviders,
    // Account-linking rules mirror the spec: Google auto-links only when
    // the provider returns a verified email; magic-link sign-in verifies
    // the address as proof of ownership before attaching.
    account: {
      accountLinking: {
        enabled: true,
        // `trustedProviders` intentionally excludes Google — we want the
        // default Better Auth behavior of requiring `email_verified=true`
        // from Google's userinfo before linking to a pre-existing account.
        trustedProviders: [],
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
          before: async (userData, context) => {
            // Gate OAuth-originated user creation on a verified email.
            // Better Auth blocks linking to an existing user when
            // `email_verified === false` (because Google isn't in our
            // `trustedProviders`), but it does not block brand-new user
            // creation — we enforce that rule here. Password sign-ups
            // land on `/sign-up/email` and are left alone, so the
            // application-owned email-verification flow can upgrade them
            // later.
            assertOAuthCreationVerified(userData, context?.path);
            return {
              data: {
                ...userData,
                email: normalizeEmail(userData.email),
              },
            };
          },
          // Every account gets exactly one personal workspace at bootstrap.
          // This runs in the same request as the Better Auth `signUp` call
          // so the workspace is guaranteed to exist before the verification
          // email (and the post-verify protected surface) are hit. Errors
          // here intentionally propagate so the API response surfaces a
          // bootstrap failure rather than silently leaving the account
          // without a home workspace; retries are safe because
          // `ensurePersonalWorkspace` is idempotent.
          after: async (createdUser) => {
            await ensurePersonalWorkspace({ userId: createdUser.id }).catch((error) => {
              childLogger({ component: "auth.user.create.after" }).error({ err: error, userId: createdUser.id }, "failed to provision personal workspace");
              throw error;
            });
          },
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
    // Plugin registration stays static regardless of env. One Tap reads its
    // clientId from the configured social provider, so leaving Google
    // credentials empty simply disables the flow at call time without
    // changing the exposed endpoint surface. Passkey credentials need an
    // explicit RP identifier and origin because the browser ceremony binds
    // the credential to that tuple at registration time.
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail({ to: email, url });
        },
        // The token stored in the verification row is hashed so a database
        // read cannot be turned into a working sign-in link, while the
        // email still carries the plaintext token for the user to click.
        storeToken: "hashed",
      }),
      oneTap(),
      passkeyPlugin({
        rpID: env.PASSKEY_RP_ID,
        rpName: env.PASSKEY_RP_NAME,
        origin: env.PASSKEY_ORIGIN ?? env.BETTER_AUTH_URL,
      }),
      // Uses the default cookie-based hint — the design keeps the hint
      // non-authoritative and purely a UX affordance for the sign-in UI.
      lastLoginMethod(),
      // Must be last so its Set-Cookie hook sees the headers produced by
      // every other plugin in the chain.
      nextCookies(),
    ],
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
