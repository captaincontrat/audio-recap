import type { Translator } from "./translator";

// Explicit map from the error `code` values surfaced by our auth APIs (and the
// subset of Better Auth's `BASE_ERROR_CODES` we actually expose to the client)
// onto translation keys in the `auth.errors.*` namespace.
//
// We keep the two namespaces living side-by-side: our app uses snake_case
// codes (`invalid_credentials`, `email_already_used`) while Better Auth uses
// SCREAMING_CASE (`USER_ALREADY_EXISTS`, `INVALID_PASSWORD`). Rather than
// reshape either side, the map lets each code route to the right localized
// message without the caller having to care which source produced the code.
//
// Any unknown code falls back to `auth.errors.unknown` via `resolveAuthErrorKey`,
// which means new codes are safe to add — they just show a generic message
// until the map is updated.

const AUTH_ERROR_KEY_BY_CODE: Record<string, string> = {
  // App-level codes emitted by route handlers in `app/app/api/auth/**`.
  invalid_input: "auth.errors.VALIDATION_ERROR",
  invalid_credentials: "auth.errors.INVALID_EMAIL_OR_PASSWORD",
  email_already_used: "auth.errors.USER_ALREADY_EXISTS",
  sign_up_failed: "auth.errors.FAILED_TO_CREATE_USER",
  invalid_token: "auth.errors.INVALID_TOKEN",
  token_expired: "auth.errors.TOKEN_EXPIRED",
  token_already_used: "auth.errors.INVALID_TOKEN",
  user_missing: "auth.errors.USER_NOT_FOUND",
  unauthenticated: "auth.errors.SESSION_EXPIRED",
  email_unverified: "auth.errors.EMAIL_NOT_VERIFIED",
  account_closed: "auth.errors.ACCOUNT_NOT_FOUND",
  already_verified: "auth.errors.EMAIL_ALREADY_VERIFIED",
  sign_out_failed: "auth.errors.unknown",
  origin_mismatch: "auth.errors.INVALID_ORIGIN",
  method_not_allowed: "auth.errors.unknown",
  server_error: "auth.errors.unknown",
  forbidden: "auth.errors.unknown",

  // Better Auth `BASE_ERROR_CODES`. We forward each of them to the matching
  // `auth.errors.<CODE>` key so Better Auth errors (thrown or returned from
  // `auth.api.*`) render in the active locale without any extra mapping.
  USER_NOT_FOUND: "auth.errors.USER_NOT_FOUND",
  FAILED_TO_CREATE_USER: "auth.errors.FAILED_TO_CREATE_USER",
  FAILED_TO_CREATE_SESSION: "auth.errors.FAILED_TO_CREATE_SESSION",
  FAILED_TO_UPDATE_USER: "auth.errors.FAILED_TO_UPDATE_USER",
  FAILED_TO_GET_SESSION: "auth.errors.FAILED_TO_GET_SESSION",
  INVALID_PASSWORD: "auth.errors.INVALID_PASSWORD",
  INVALID_EMAIL: "auth.errors.INVALID_EMAIL",
  INVALID_EMAIL_OR_PASSWORD: "auth.errors.INVALID_EMAIL_OR_PASSWORD",
  INVALID_USER: "auth.errors.INVALID_USER",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "auth.errors.SOCIAL_ACCOUNT_ALREADY_LINKED",
  PROVIDER_NOT_FOUND: "auth.errors.PROVIDER_NOT_FOUND",
  INVALID_TOKEN: "auth.errors.INVALID_TOKEN",
  ID_TOKEN_NOT_SUPPORTED: "auth.errors.ID_TOKEN_NOT_SUPPORTED",
  FAILED_TO_GET_USER_INFO: "auth.errors.FAILED_TO_GET_USER_INFO",
  USER_EMAIL_NOT_FOUND: "auth.errors.USER_EMAIL_NOT_FOUND",
  EMAIL_NOT_VERIFIED: "auth.errors.EMAIL_NOT_VERIFIED",
  PASSWORD_TOO_SHORT: "auth.errors.PASSWORD_TOO_SHORT",
  PASSWORD_TOO_LONG: "auth.errors.PASSWORD_TOO_LONG",
  USER_ALREADY_EXISTS: "auth.errors.USER_ALREADY_EXISTS",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "auth.errors.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  EMAIL_CAN_NOT_BE_UPDATED: "auth.errors.EMAIL_CAN_NOT_BE_UPDATED",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "auth.errors.CREDENTIAL_ACCOUNT_NOT_FOUND",
  SESSION_EXPIRED: "auth.errors.SESSION_EXPIRED",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "auth.errors.FAILED_TO_UNLINK_LAST_ACCOUNT",
  ACCOUNT_NOT_FOUND: "auth.errors.ACCOUNT_NOT_FOUND",
  USER_ALREADY_HAS_PASSWORD: "auth.errors.USER_ALREADY_HAS_PASSWORD",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: "auth.errors.CROSS_SITE_NAVIGATION_LOGIN_BLOCKED",
  VERIFICATION_EMAIL_NOT_ENABLED: "auth.errors.VERIFICATION_EMAIL_NOT_ENABLED",
  EMAIL_ALREADY_VERIFIED: "auth.errors.EMAIL_ALREADY_VERIFIED",
  EMAIL_MISMATCH: "auth.errors.EMAIL_MISMATCH",
  SESSION_NOT_FRESH: "auth.errors.SESSION_NOT_FRESH",
  LINKED_ACCOUNT_ALREADY_EXISTS: "auth.errors.LINKED_ACCOUNT_ALREADY_EXISTS",
  INVALID_ORIGIN: "auth.errors.INVALID_ORIGIN",
  INVALID_CALLBACK_URL: "auth.errors.INVALID_CALLBACK_URL",
  INVALID_REDIRECT_URL: "auth.errors.INVALID_REDIRECT_URL",
  INVALID_ERROR_CALLBACK_URL: "auth.errors.INVALID_ERROR_CALLBACK_URL",
  INVALID_NEW_USER_CALLBACK_URL: "auth.errors.INVALID_NEW_USER_CALLBACK_URL",
  MISSING_OR_NULL_ORIGIN: "auth.errors.MISSING_OR_NULL_ORIGIN",
  CALLBACK_URL_REQUIRED: "auth.errors.CALLBACK_URL_REQUIRED",
  FAILED_TO_CREATE_VERIFICATION: "auth.errors.FAILED_TO_CREATE_VERIFICATION",
  FIELD_NOT_ALLOWED: "auth.errors.FIELD_NOT_ALLOWED",
  ASYNC_VALIDATION_NOT_SUPPORTED: "auth.errors.ASYNC_VALIDATION_NOT_SUPPORTED",
  VALIDATION_ERROR: "auth.errors.VALIDATION_ERROR",
  MISSING_FIELD: "auth.errors.MISSING_FIELD",
  METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED: "auth.errors.METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED",
  BODY_MUST_BE_AN_OBJECT: "auth.errors.BODY_MUST_BE_AN_OBJECT",
  TOKEN_EXPIRED: "auth.errors.TOKEN_EXPIRED",
  PASSWORD_ALREADY_SET: "auth.errors.PASSWORD_ALREADY_SET",
};

export const UNKNOWN_AUTH_ERROR_KEY = "auth.errors.unknown";

// Returns the translation key associated with a given auth error `code`.
// The map is case-sensitive: Better Auth codes are SCREAMING_CASE, our app
// codes are snake_case, and they never collide. Unknown codes resolve to the
// generic fallback so the UI always has a message to show.
export function resolveAuthErrorKey(code: string | null | undefined): string {
  if (typeof code !== "string" || code.length === 0) {
    return UNKNOWN_AUTH_ERROR_KEY;
  }
  return AUTH_ERROR_KEY_BY_CODE[code] ?? UNKNOWN_AUTH_ERROR_KEY;
}

// Convenience wrapper for the common case of "I have a code and a translator,
// give me a localized message." The optional `fallback` is returned when the
// key resolution itself lands on the generic unknown bucket — useful to keep
// server-supplied messages visible when they are more specific than the
// generic fallback.
export function localizeAuthError({ code, translate, fallback }: { code: string | null | undefined; translate: Translator; fallback?: string | null }): string {
  const key = resolveAuthErrorKey(code);
  const translated = translate(key);
  if (translated === key && typeof fallback === "string" && fallback.length > 0) {
    return fallback;
  }
  if (key === UNKNOWN_AUTH_ERROR_KEY && typeof fallback === "string" && fallback.length > 0) {
    return fallback;
  }
  return translated;
}
