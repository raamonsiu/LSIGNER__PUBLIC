import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';

import enMessages from '../../messages/en.json';

/**
 * Wraps a component tree with next-intl's provider using English messages.
 * Use this in unit tests for components that call `useTranslations()`.
 */
export function withIntlProvider(
  children: ReactNode,
  messages?: AbstractIntlMessages,
) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages ?? (enMessages as AbstractIntlMessages)}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Wraps a component tree with next-intl provider for a specific locale.
 */
export function withLocale(locale: string, children: ReactNode) {
  let messages: AbstractIntlMessages;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    messages = require(`../../messages/${locale}.json`) as AbstractIntlMessages;
  } catch {
    messages = enMessages as AbstractIntlMessages;
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
