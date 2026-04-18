import { describe, expect, test } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { createTranslator, translate } from "@/lib/i18n/translator";

describe("translate", () => {
  test("returns the translation for the active locale", () => {
    const message = translate({
      key: "auth.signIn.title",
      locale: "fr",
      dictionaries: DICTIONARIES,
    });
    expect(message).toBe("Se connecter");
  });

  test("falls back to the English dictionary when the key is missing in the active locale", () => {
    const localDictionaries = {
      ...DICTIONARIES,
      fr: { ...DICTIONARIES.fr },
    };
    delete localDictionaries.fr["auth.signIn.title"];

    const message = translate({
      key: "auth.signIn.title",
      locale: "fr",
      dictionaries: localDictionaries,
    });
    expect(message).toBe(DICTIONARIES.en["auth.signIn.title"]);
  });

  test("returns the raw key when neither the locale nor English have it", () => {
    const message = translate({
      key: "auth.unknown.key",
      locale: "fr",
      dictionaries: DICTIONARIES,
    });
    expect(message).toBe("auth.unknown.key");
  });

  test("interpolates variables using {{name}} syntax", () => {
    const message = translate({
      key: "chrome.dashboard.welcome",
      locale: "en",
      dictionaries: DICTIONARIES,
      vars: { name: "Alex" },
    });
    expect(message).toBe("Welcome back, Alex");
  });

  test("stringifies non-string interpolation values", () => {
    const message = translate({
      key: "chrome.accountSecurity.close.body",
      locale: "en",
      dictionaries: DICTIONARIES,
      vars: { days: 30 },
    });
    expect(message).toContain("30-day");
  });

  test("leaves placeholders in place when a variable is missing", () => {
    const message = translate({
      key: "chrome.dashboard.welcome",
      locale: "en",
      dictionaries: DICTIONARIES,
    });
    expect(message).toContain("{{name}}");
  });
});

describe("createTranslator", () => {
  test("returns a function that carries its locale and dictionaries", () => {
    const translator = createTranslator({ locale: "de", dictionaries: DICTIONARIES });
    expect(translator("auth.signIn.title")).toBe("Anmelden");
    expect(translator("chrome.dashboard.welcome", { name: "Maria" })).toContain("Maria");
  });
});

describe("dictionary parity", () => {
  test("every supported locale shares the same translation keys", () => {
    const englishKeys = new Set(Object.keys(DICTIONARIES.en));
    for (const locale of SUPPORTED_LOCALES) {
      const localeKeys = new Set(Object.keys(DICTIONARIES[locale]));
      expect(localeKeys).toEqual(englishKeys);
    }
  });

  test("every translated value is a non-empty string", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dictionary = DICTIONARIES[locale];
      for (const [key, value] of Object.entries(dictionary)) {
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
