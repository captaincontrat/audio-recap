import { describe, expect, test } from "vitest";

import { DEFAULT_LOCALE, isSupportedLocale, matchLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locales";

describe("SUPPORTED_LOCALES", () => {
  test("includes exactly the four supported locales from the spec", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "fr", "de", "es"]);
  });

  test("DEFAULT_LOCALE is English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("isSupportedLocale", () => {
  test("accepts every supported locale tag", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
  });

  test("rejects unsupported or malformed inputs", () => {
    expect(isSupportedLocale("it")).toBe(false);
    expect(isSupportedLocale("en-US")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
  });
});

describe("matchLocale", () => {
  test("returns exact matches for supported locales", () => {
    expect(matchLocale("en")).toBe("en");
    expect(matchLocale("fr")).toBe("fr");
    expect(matchLocale("de")).toBe("de");
    expect(matchLocale("es")).toBe("es");
  });

  test("normalises casing and regional suffixes", () => {
    expect(matchLocale("EN")).toBe("en");
    expect(matchLocale("fr-CA")).toBe("fr");
    expect(matchLocale("de_AT")).toBe("de");
    expect(matchLocale("ES-419")).toBe("es");
  });

  test("returns null for unknown or empty tags", () => {
    expect(matchLocale("ja")).toBeNull();
    expect(matchLocale("zh-TW")).toBeNull();
    expect(matchLocale("")).toBeNull();
    expect(matchLocale(null)).toBeNull();
    expect(matchLocale(undefined)).toBeNull();
  });
});
