// Pure presentation helper for the `last-login-method` plugin's cookie value.
// The plugin emits short codes like `email`, `google`, `magic-link`, or
// `passkey`; the sign-in UI needs a human-readable phrase. Anything we don't
// recognise (e.g. a provider id we haven't added a mapping for yet) returns
// `null` so the caller can skip rendering — the hint is advisory only and
// must never block or hide a sign-in method.

export type LastLoginMethodLabel = "your email and password" | "a magic link" | "a passkey" | "Google";

export function describeLastLoginMethod(method: string | null | undefined): LastLoginMethodLabel | null {
  if (typeof method !== "string" || method.length === 0) {
    return null;
  }
  switch (method) {
    case "email":
      return "your email and password";
    case "magic-link":
      return "a magic link";
    case "passkey":
      return "a passkey";
    case "google":
      return "Google";
    default:
      return null;
  }
}

// Locale-aware sibling of `describeLastLoginMethod`. Returns the translation
// key that should be rendered for a given cookie value, or `null` when the
// method is unrecognised. The UI composes this with `useTranslator()` so the
// phrase ("your email and password" vs. "votre e-mail et votre mot de passe")
// follows the active locale without touching this mapping when a new locale
// ships.
export type LastLoginMethodKey =
  | "auth.lastLoginMethod.method.email"
  | "auth.lastLoginMethod.method.magicLink"
  | "auth.lastLoginMethod.method.passkey"
  | "auth.lastLoginMethod.method.google";

export function describeLastLoginMethodKey(method: string | null | undefined): LastLoginMethodKey | null {
  if (typeof method !== "string" || method.length === 0) {
    return null;
  }
  switch (method) {
    case "email":
      return "auth.lastLoginMethod.method.email";
    case "magic-link":
      return "auth.lastLoginMethod.method.magicLink";
    case "passkey":
      return "auth.lastLoginMethod.method.passkey";
    case "google":
      return "auth.lastLoginMethod.method.google";
    default:
      return null;
  }
}
