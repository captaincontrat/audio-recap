import { describe, expect, test } from "vitest";

import { parseAcceptLanguage, resolveLocaleFromSources } from "@/lib/i18n/detect";

describe("parseAcceptLanguage", () => {
  test("returns null for missing or empty headers", () => {
    expect(parseAcceptLanguage(undefined)).toBeNull();
    expect(parseAcceptLanguage(null)).toBeNull();
    expect(parseAcceptLanguage("")).toBeNull();
  });

  test("picks the first supported locale in order", () => {
    expect(parseAcceptLanguage("fr-CA,en;q=0.8,de;q=0.6")).toBe("fr");
    expect(parseAcceptLanguage("de,en-US;q=0.7")).toBe("de");
  });

  test("respects quality weights when re-ordering entries", () => {
    expect(parseAcceptLanguage("en;q=0.5, fr-CA;q=0.9")).toBe("fr");
    expect(parseAcceptLanguage("de;q=0.4, es;q=0.8")).toBe("es");
  });

  test("skips unsupported tags and keeps going", () => {
    expect(parseAcceptLanguage("ja, zh-TW, fr")).toBe("fr");
    expect(parseAcceptLanguage("pt-BR;q=0.9, de;q=0.8")).toBe("de");
  });

  test("returns null when every tag is unsupported", () => {
    expect(parseAcceptLanguage("ja, ko, zh-CN")).toBeNull();
  });

  test("ignores entries with q=0 since they signal unsupported by client", () => {
    expect(parseAcceptLanguage("fr;q=0, en")).toBe("en");
  });
});

describe("resolveLocaleFromSources", () => {
  test("cookie preference wins over accept-language and default", () => {
    expect(
      resolveLocaleFromSources({
        cookieValue: "es",
        acceptLanguage: "fr,de",
      }),
    ).toEqual({ locale: "es", source: "cookie" });
  });

  test("accept-language resolves when no cookie is stored", () => {
    expect(
      resolveLocaleFromSources({
        cookieValue: null,
        acceptLanguage: "de-AT,en;q=0.5",
      }),
    ).toEqual({ locale: "de", source: "accept-language" });
  });

  test("falls back to English when neither source matches", () => {
    expect(
      resolveLocaleFromSources({
        cookieValue: "it",
        acceptLanguage: "ja, zh-CN",
      }),
    ).toEqual({ locale: "en", source: "default" });
  });

  test("falls back to English when both sources are empty", () => {
    expect(
      resolveLocaleFromSources({
        cookieValue: undefined,
        acceptLanguage: undefined,
      }),
    ).toEqual({ locale: "en", source: "default" });
  });

  test("ignores an unsupported cookie value and falls back to the header", () => {
    expect(
      resolveLocaleFromSources({
        cookieValue: "xx",
        acceptLanguage: "fr",
      }),
    ).toEqual({ locale: "fr", source: "accept-language" });
  });
});
