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
