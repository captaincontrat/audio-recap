// Single source of truth for the supported locale set. Every other module
// in `lib/i18n/` — detection, dictionaries, the translator, the auth-error
// map — depends on this list, so the supported languages only need to change
// in one place when the product scope grows.

export const SUPPORTED_LOCALES = ["en", "fr", "de", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

// English is the foundation's fallback language (see design.md). Any locale
// that we cannot recognise, cannot map, or cannot translate a key in MUST
// resolve back to `en` — that contract is enforced by `resolveLocale` and
// `translate` and asserted by the unit tests.
export const DEFAULT_LOCALE: Locale = "en";

// Stored alongside `summitdown.session_token` to keep the app's cookie
// namespace consistent. The cookie carries the user's explicit locale
// preference; `Accept-Language` is the passive fallback when no preference
// has been stored yet.
export const LOCALE_COOKIE_NAME = "summitdown.locale";

// One year in seconds. Long enough that users who pick French once do not
// get reset to English on their next visit, short enough that a stale
// preference cannot outlive a typical account lifecycle.
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Accepts a raw locale tag like `fr-CA` or `pt_BR` and returns the first
// supported locale that matches the primary language subtag. Returns `null`
// when nothing matches so the caller can decide what to do (typically fall
// back to the next source or to `DEFAULT_LOCALE`).
export function matchLocale(raw: string | null | undefined): Locale | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  if (isSupportedLocale(normalized)) {
    return normalized;
  }
  const primary = normalized.split(/[-_]/)[0] ?? "";
  if (isSupportedLocale(primary)) {
    return primary;
  }
  return null;
}
