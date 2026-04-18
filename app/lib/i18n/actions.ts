"use server";

import { cookies } from "next/headers";
import { isSupportedLocale, LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME, type Locale } from "./locales";

// Server action used by any future locale-switcher UI. Writes the chosen
// locale into the shared `summitdown.locale` cookie so subsequent server
// renders resolve to the same value without relying on the `Accept-Language`
// header fallback. Returning the resolved locale (or `null` on an invalid
// input) keeps the caller free of error-throwing control flow.
export async function setLocalePreference(locale: string): Promise<Locale | null> {
  if (!isSupportedLocale(locale)) {
    return null;
  }
  const cookieJar = await cookies();
  cookieJar.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
  });
  return locale;
}
