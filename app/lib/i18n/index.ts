export { DICTIONARIES, en, fr, de, es } from "./dictionaries";
export type { EnglishDictionary, TranslationKey } from "./dictionaries";
export {
  parseAcceptLanguage,
  resolveLocaleFromSources,
  type LocaleSource,
  type ResolvedLocale,
} from "./detect";
export {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  matchLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from "./locales";
export {
  createTranslator,
  translate,
  type Dictionary,
  type Translator,
  type TranslationVars,
} from "./translator";
export {
  localizeAuthError,
  resolveAuthErrorKey,
  UNKNOWN_AUTH_ERROR_KEY,
} from "./auth-errors";
