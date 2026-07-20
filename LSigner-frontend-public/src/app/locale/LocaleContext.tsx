'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';

import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isValidLocale,
  type Locale,
} from './config';

export { LOCALE_COOKIE, SUPPORTED_LOCALES, DEFAULT_LOCALE };
export type { Locale };

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

interface LocaleContextValue {
  locale: Locale;
  messages: AbstractIntlMessages;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context)
    throw new Error('useLocaleContext must be used within a LocaleProvider');
  return context;
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(`(?:^|;\\s*)${name}=([^;]*)`);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch {
    return (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
  }
}

export function LocaleProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialMessages: AbstractIntlMessages;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] =
    useState<AbstractIntlMessages>(initialMessages);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setCookie(LOCALE_COOKIE, next);
    loadMessages(next).then(setMessages);
    document.documentElement.setAttribute('lang', next);
  }, []);

  const contextValue = useMemo(
    () => ({ locale, messages, setLocale }),
    [locale, messages, setLocale],
  );

  return (
    <LocaleContext.Provider value={contextValue}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="Europe/Madrid"
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const cookie = getCookie(LOCALE_COOKIE);
  if (cookie && isValidLocale(cookie)) return cookie;
  const browserLang = navigator.language?.slice(0, 2);
  if (browserLang && isValidLocale(browserLang)) return browserLang;
  return DEFAULT_LOCALE;
}
