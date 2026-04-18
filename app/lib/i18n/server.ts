import "server-only";

import { cookies, headers } from "next/headers";
import { DICTIONARIES } from "./dictionaries";
import { resolveLocaleFromSources, type ResolvedLocale } from "./detect";
import { LOCALE_COOKIE_NAME, type Locale } from "./locales";
import { createTranslator, type Translator } from "./translator";

// Server-side locale resolution. Runs in Next.js server components, route
// handlers, and server actions. The caller typically just wants a translator,
// so `getServerTranslator` bundles the cookie + `Accept-Language` read with
// the dictionary lookup in one call. The lower-level `getServerLocale`
// exposes the source (cookie vs. header vs. default) for callers that need
// to branch on it — for example a locale switcher that highlights the
// persisted preference.

export async function getServerLocale(): Promise<ResolvedLocale> {
  const [cookieJar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const cookieValue = cookieJar.get(LOCALE_COOKIE_NAME)?.value ?? null;
  const acceptLanguage = requestHeaders.get("accept-language");
  return resolveLocaleFromSources({ cookieValue, acceptLanguage });
}

export async function getServerTranslator(): Promise<{ locale: Locale; translate: Translator }> {
  const { locale } = await getServerLocale();
  return {
    locale,
    translate: createTranslator({ locale, dictionaries: DICTIONARIES }),
  };
}
