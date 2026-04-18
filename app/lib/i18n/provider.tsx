"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { DICTIONARIES } from "./dictionaries";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { createTranslator, type Translator, type TranslationVars } from "./translator";

// Client-facing bridge for the shared locale model. The server resolves the
// active locale once (in the root layout) and hands it down to client
// components through this context so every auth form, chrome button, and
// error banner can translate keys without re-running detection on every
// render. Client components never import dictionaries directly — they go
// through `useTranslator()` or `useLocale()`.

type LocaleContextValue = {
  locale: Locale;
  translate: Translator;
};

const DEFAULT_CONTEXT: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  translate: createTranslator({ locale: DEFAULT_LOCALE, dictionaries: DICTIONARIES }),
};

const LocaleContext = createContext<LocaleContextValue>(DEFAULT_CONTEXT);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      translate: createTranslator({ locale, dictionaries: DICTIONARIES }),
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// Hook surface used by UI components. Splitting into two hooks keeps intent
// visible: `useTranslator` is the common case; `useLocale` is for the rare
// surface (locale switcher, analytics) that needs the raw tag.
export function useTranslator(): Translator {
  return useContext(LocaleContext).translate;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

// Re-exported so callers can type values without importing from
// `./translator` directly.
export type { TranslationVars };
