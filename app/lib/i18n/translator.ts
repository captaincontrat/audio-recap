import { DEFAULT_LOCALE, type Locale } from "./locales";

// A dictionary is a flat record of translation key -> translated string.
// Keys use dotted namespaces (`auth.signIn.submit`) so catalogs stay readable
// without needing a nested object schema. Every locale dictionary is typed
// against the shape of the English dictionary so missing keys become a
// compile-time error rather than a silent runtime fallback.
export type Dictionary = Record<string, string>;

// `{{name}}`-style placeholders. The interpolation values are stringified
// with `String(value)` so numbers and booleans work without the caller
// having to convert them manually — important for locale-specific date and
// count formatting that already returns strings.
export type TranslationVars = Record<string, string | number | boolean>;

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function interpolate(template: string, vars: TranslationVars | undefined): string {
  if (!vars) {
    return template;
  }
  return template.replace(PLACEHOLDER_PATTERN, (match, rawName) => {
    const name = String(rawName);
    if (Object.hasOwn(vars, name)) {
      return String(vars[name]);
    }
    return match;
  });
}

export type TranslatorInput = {
  key: string;
  locale: Locale;
  dictionaries: Record<Locale, Dictionary>;
  vars?: TranslationVars;
};

// Translates `key` using the requested locale's dictionary. The fallback
// contract from design.md is enforced here: when the active locale is
// missing a key we fall back to the English dictionary before giving up
// and returning the raw key so the missing translation is still visible.
export function translate({ key, locale, dictionaries, vars }: TranslatorInput): string {
  const primary = dictionaries[locale]?.[key];
  if (typeof primary === "string") {
    return interpolate(primary, vars);
  }
  if (locale !== DEFAULT_LOCALE) {
    const fallback = dictionaries[DEFAULT_LOCALE]?.[key];
    if (typeof fallback === "string") {
      return interpolate(fallback, vars);
    }
  }
  return key;
}

export type Translator = (key: string, vars?: TranslationVars) => string;

export function createTranslator({ locale, dictionaries }: { locale: Locale; dictionaries: Record<Locale, Dictionary> }): Translator {
  return (key, vars) => translate({ key, locale, dictionaries, vars });
}
