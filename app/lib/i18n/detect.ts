import { DEFAULT_LOCALE, type Locale, matchLocale } from "./locales";

// Parses a standard `Accept-Language` header and returns the first supported
// locale in quality-weighted order. Quality values (`;q=`) are respected so
// browsers that send `en;q=0.5, fr-CA;q=0.9` resolve to `fr` rather than
// `en`. A missing, empty, or unparsable header returns `null` so the caller
// can fall back to the next source (cookie, default).
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }
  const entries = header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [tag, ...params] = part.split(";").map((segment) => segment.trim());
      let quality = 1;
      for (const param of params) {
        const match = /^q=([0-9]*\.?[0-9]+)$/i.exec(param);
        if (match?.[1]) {
          const parsed = Number.parseFloat(match[1]);
          if (Number.isFinite(parsed)) {
            quality = Math.max(0, Math.min(1, parsed));
          }
        }
      }
      return { tag: tag ?? "", quality };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0);

  entries.sort((a, b) => b.quality - a.quality);

  for (const entry of entries) {
    const matched = matchLocale(entry.tag);
    if (matched) {
      return matched;
    }
  }
  return null;
}

export type LocaleSource = "cookie" | "accept-language" | "default";

export type ResolvedLocale = {
  locale: Locale;
  source: LocaleSource;
};

// Locale negotiation follows a strict priority: an explicit user preference
// stored in the cookie wins, then the browser's `Accept-Language` header
// acts as the passive signal, and finally we land on `DEFAULT_LOCALE`.
// Returning the source alongside the locale lets callers (for example
// analytics or locale-switcher UIs) distinguish a stored preference from a
// default fallback without re-running the negotiation.
export function resolveLocaleFromSources({
  cookieValue,
  acceptLanguage,
}: {
  cookieValue: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): ResolvedLocale {
  const fromCookie = matchLocale(cookieValue);
  if (fromCookie) {
    return { locale: fromCookie, source: "cookie" };
  }
  const fromHeader = parseAcceptLanguage(acceptLanguage);
  if (fromHeader) {
    return { locale: fromHeader, source: "accept-language" };
  }
  return { locale: DEFAULT_LOCALE, source: "default" };
}
