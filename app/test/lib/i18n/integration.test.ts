import { describe, expect, test } from "vitest";

import { localizeAuthError } from "@/lib/i18n/auth-errors";
import { resolveLocaleFromSources } from "@/lib/i18n/detect";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { createTranslator } from "@/lib/i18n/translator";

// These tests exercise the full resolve → translate → localize pipeline so
// that Better Auth errors end up in the same locale that the rest of the
// chrome is rendered with, and that English fallback kicks in when the user's
// preferred locale is unsupported.

describe("Better Auth error + locale pipeline", () => {
  test("resolves the active locale and translates the error consistently", () => {
    const { locale } = resolveLocaleFromSources({
      cookieValue: null,
      acceptLanguage: "fr-CA,en;q=0.5",
    });
    const translate = createTranslator({ locale, dictionaries: DICTIONARIES });

    expect(locale).toBe("fr");
    expect(translate("auth.signIn.heading")).toBe(DICTIONARIES.fr["auth.signIn.heading"]);
    expect(localizeAuthError({ code: "USER_NOT_FOUND", translate })).toBe(DICTIONARIES.fr["auth.errors.USER_NOT_FOUND"]);
  });

  test("cookie preference overrides accept-language for both chrome and errors", () => {
    const { locale } = resolveLocaleFromSources({
      cookieValue: "de",
      acceptLanguage: "fr,en;q=0.5",
    });
    const translate = createTranslator({ locale, dictionaries: DICTIONARIES });

    expect(locale).toBe("de");
    expect(translate("chrome.dashboard.welcome", { name: "Maria" })).toContain("Maria");
    expect(localizeAuthError({ code: "INVALID_PASSWORD", translate })).toBe(DICTIONARIES.de["auth.errors.INVALID_PASSWORD"]);
  });

  test("unsupported preferred locale falls back to English for both chrome and errors", () => {
    const { locale, source } = resolveLocaleFromSources({
      cookieValue: "it",
      acceptLanguage: "ja, zh-CN",
    });
    const translate = createTranslator({ locale, dictionaries: DICTIONARIES });

    expect(locale).toBe("en");
    expect(source).toBe("default");
    expect(translate("auth.signIn.heading")).toBe(DICTIONARIES.en["auth.signIn.heading"]);
    expect(localizeAuthError({ code: "USER_NOT_FOUND", translate })).toBe(DICTIONARIES.en["auth.errors.USER_NOT_FOUND"]);
  });

  test("Better Auth error in active locale still falls through to English when that specific key is missing", () => {
    // Simulate a dictionary where the French catalog is missing a fresh
    // Better Auth error key — the translator must silently borrow the
    // English value rather than showing the raw translation key.
    const localDictionaries = {
      ...DICTIONARIES,
      fr: { ...DICTIONARIES.fr },
    };
    delete localDictionaries.fr["auth.errors.TOKEN_EXPIRED"];

    const translate = createTranslator({ locale: "fr", dictionaries: localDictionaries });
    const message = localizeAuthError({ code: "TOKEN_EXPIRED", translate });
    expect(message).toBe(DICTIONARIES.en["auth.errors.TOKEN_EXPIRED"]);
  });

  test("snake_case app codes and SCREAMING_CASE Better Auth codes resolve to the same localized message", () => {
    const translate = createTranslator({ locale: "es", dictionaries: DICTIONARIES });

    const appCode = localizeAuthError({ code: "email_already_used", translate });
    const betterAuthCode = localizeAuthError({ code: "USER_ALREADY_EXISTS", translate });

    expect(appCode).toBe(DICTIONARIES.es["auth.errors.USER_ALREADY_EXISTS"]);
    expect(betterAuthCode).toBe(appCode);
  });
});
