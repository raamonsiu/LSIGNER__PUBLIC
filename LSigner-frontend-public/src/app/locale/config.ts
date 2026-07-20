export const LOCALE_COOKIE = 'locale';

export const SUPPORTED_LOCALES = ['en', 'es', 'ca'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isValidLocale(value: string | undefined): value is Locale {
  if (!value) return false;
  return SUPPORTED_LOCALES.includes(value as Locale);
}
