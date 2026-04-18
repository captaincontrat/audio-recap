import type { Locale } from "../locales";
import type { Dictionary } from "../translator";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";

// Central dictionaries registry keyed by supported locale. Any consumer that
// needs to translate a key (server components, client components, server
// actions, auth error mapping) imports this record so there is only one place
// to register new locale catalogs.

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  fr,
  de,
  es,
};

export { en, fr, de, es };
export type { TranslationKey, EnglishDictionary } from "./en";
