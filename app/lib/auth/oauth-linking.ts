// Pure decision helpers that gate OAuth/One Tap account creation and linking
// on the spec rule "create or link only when the provider returns a verified
// email". Better Auth's default behavior already blocks linking when the
// provider isn't trusted and `emailVerified === false`, but it does not
// block brand-new user creation — so we enforce that rule ourselves.
//
// These helpers stay free of framework dependencies so `instance.ts` (which
// is excluded from jsdom coverage because it boots the Better Auth app)
// can call them while unit tests exercise the same rules directly.

// Every Better Auth context path that corresponds to an OAuth/One Tap user
// creation. The resolver in `last-login-method` uses the same prefixes, so
// the rule is written once here.
const OAUTH_CREATION_PATH_PREFIXES = ["/callback/", "/oauth2/callback/"] as const;
const OAUTH_CREATION_EXACT_PATHS = ["/one-tap/callback"] as const;

export function isOAuthCreationPath(path: string | undefined | null): boolean {
  if (typeof path !== "string" || path.length === 0) {
    return false;
  }
  if (OAUTH_CREATION_EXACT_PATHS.includes(path as (typeof OAUTH_CREATION_EXACT_PATHS)[number])) {
    return true;
  }
  for (const prefix of OAUTH_CREATION_PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

// Mirrors the Google OpenID Connect userinfo payload shape — Better Auth
// passes the raw provider profile into `mapProfileToUser`. We only care
// about `email_verified` here; other fields are ignored.
export type GoogleProfileShape = {
  email_verified?: boolean | null;
};

export class GoogleEmailUnverifiedError extends Error {
  constructor() {
    super("google_email_unverified");
    this.name = "GoogleEmailUnverifiedError";
  }
}

export class OAuthEmailUnverifiedError extends Error {
  constructor() {
    super("oauth_email_unverified");
    this.name = "OAuthEmailUnverifiedError";
  }
}

// Throw when Google's userinfo payload doesn't assert a verified email.
// Returning void on success keeps the call site free of boolean coupling —
// the caller just wraps the throw in Better Auth's `mapProfileToUser`.
export function assertGoogleProfileVerified(profile: GoogleProfileShape): void {
  if (profile.email_verified !== true) {
    throw new GoogleEmailUnverifiedError();
  }
}

export type OAuthCreationUserData = {
  emailVerified?: boolean | null | undefined;
};

// Throw when Better Auth is about to persist a new OAuth/One Tap user whose
// email has not been asserted verified. Password sign-ups hit a different
// path (`/sign-up/email`), so they are left alone — the verification flow
// upgrades them later.
export function assertOAuthCreationVerified(userData: OAuthCreationUserData, path: string | undefined | null): void {
  if (!isOAuthCreationPath(path)) {
    return;
  }
  if (userData.emailVerified !== true) {
    throw new OAuthEmailUnverifiedError();
  }
}
