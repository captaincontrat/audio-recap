import { describe, expect, test } from "vitest";

import { localizeAuthError, resolveAuthErrorKey, UNKNOWN_AUTH_ERROR_KEY } from "@/lib/i18n/auth-errors";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { createTranslator } from "@/lib/i18n/translator";

describe("resolveAuthErrorKey", () => {
  test("maps Better Auth SCREAMING_CASE codes to auth.errors keys", () => {
    expect(resolveAuthErrorKey("USER_NOT_FOUND")).toBe("auth.errors.USER_NOT_FOUND");
    expect(resolveAuthErrorKey("INVALID_PASSWORD")).toBe("auth.errors.INVALID_PASSWORD");
    expect(resolveAuthErrorKey("INVALID_EMAIL_OR_PASSWORD")).toBe("auth.errors.INVALID_EMAIL_OR_PASSWORD");
  });

  test("maps app-level snake_case codes to auth.errors keys", () => {
    expect(resolveAuthErrorKey("invalid_credentials")).toBe("auth.errors.INVALID_EMAIL_OR_PASSWORD");
    expect(resolveAuthErrorKey("email_already_used")).toBe("auth.errors.USER_ALREADY_EXISTS");
    expect(resolveAuthErrorKey("email_unverified")).toBe("auth.errors.EMAIL_NOT_VERIFIED");
  });

  test("returns the unknown bucket for unmapped codes or missing input", () => {
    expect(resolveAuthErrorKey("something_else")).toBe(UNKNOWN_AUTH_ERROR_KEY);
    expect(resolveAuthErrorKey(undefined)).toBe(UNKNOWN_AUTH_ERROR_KEY);
    expect(resolveAuthErrorKey(null)).toBe(UNKNOWN_AUTH_ERROR_KEY);
    expect(resolveAuthErrorKey("")).toBe(UNKNOWN_AUTH_ERROR_KEY);
  });
});

describe("localizeAuthError", () => {
  test("returns the translated message for a Better Auth error in the active locale", () => {
    const translate = createTranslator({ locale: "fr", dictionaries: DICTIONARIES });
    const message = localizeAuthError({ code: "USER_NOT_FOUND", translate });
    expect(message).toBe(DICTIONARIES.fr["auth.errors.USER_NOT_FOUND"]);
  });

  test("returns the translated message in Spanish for a matching code", () => {
    const translate = createTranslator({ locale: "es", dictionaries: DICTIONARIES });
    const message = localizeAuthError({ code: "INVALID_PASSWORD", translate });
    expect(message).toBe(DICTIONARIES.es["auth.errors.INVALID_PASSWORD"]);
  });

  test("falls back to English when the active locale lacks a specific key", () => {
    const localDictionaries = {
      ...DICTIONARIES,
      de: { ...DICTIONARIES.de },
    };
    delete localDictionaries.de["auth.errors.USER_NOT_FOUND"];

    const translate = createTranslator({ locale: "de", dictionaries: localDictionaries });
    const message = localizeAuthError({ code: "USER_NOT_FOUND", translate });
    expect(message).toBe(DICTIONARIES.en["auth.errors.USER_NOT_FOUND"]);
  });

  test("returns the generic unknown message for unmapped codes in every locale", () => {
    for (const locale of ["en", "fr", "de", "es"] as const) {
      const translate = createTranslator({ locale, dictionaries: DICTIONARIES });
      const message = localizeAuthError({ code: "brand_new_code", translate });
      expect(message).toBe(DICTIONARIES[locale][UNKNOWN_AUTH_ERROR_KEY]);
    }
  });

  test("prefers a server-supplied fallback over the generic unknown message", () => {
    const translate = createTranslator({ locale: "fr", dictionaries: DICTIONARIES });
    const message = localizeAuthError({
      code: "brand_new_code",
      translate,
      fallback: "The server provided this specific explanation.",
    });
    expect(message).toBe("The server provided this specific explanation.");
  });

  test("keeps the translated message when the code is known, even if a fallback is given", () => {
    const translate = createTranslator({ locale: "fr", dictionaries: DICTIONARIES });
    const message = localizeAuthError({
      code: "USER_NOT_FOUND",
      translate,
      fallback: "English server message",
    });
    expect(message).toBe(DICTIONARIES.fr["auth.errors.USER_NOT_FOUND"]);
  });
});
