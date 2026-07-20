import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Script from 'next/script';
import { Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { AppThemeProvider, type ThemeMode } from '@/app/theme/ThemeContext';
import { AckeeRouteChangeBridge } from '@/components/providers/AckeeRouteChangeBridge';
import { SnackbarProvider } from '@/components/providers/SnackbarProvider';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { parseAckeeAnalyticsConfig } from '@/lib/analytics/ackeeConfig';
import { LocaleProvider } from '@/app/locale';
import {
  LOCALE_COOKIE,
  DEFAULT_LOCALE,
  isValidLocale,
  type Locale,
} from '@/app/locale/config';
import type { AbstractIntlMessages } from 'next-intl';
import './globals.css';

const geistMono = Geist_Mono({ 
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const mplusu = localFont({// Awesome font but it is not in google catalog so nned to have it locally
  src: './fonts/MPLUSU.woff2',
  variable: '--font-mplusu',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'LSigner',
  description: 'Digital document signing platform',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsConfig = parseAckeeAnalyticsConfig(process.env);

  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get('theme')?.value;
  const initialMode: ThemeMode = cookieTheme === 'light' ? 'light' : 'dark';

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const initialLocale: Locale = isValidLocale(cookieLocale)
    ? cookieLocale
    : DEFAULT_LOCALE;

  let initialMessages: AbstractIntlMessages;
  try {
    initialMessages = (await import(`../messages/${initialLocale}.json`))
      .default as AbstractIntlMessages;
  } catch {
    initialMessages = (await import(`../messages/${DEFAULT_LOCALE}.json`))
      .default as AbstractIntlMessages;
  }

  return (
    <html
      lang={initialLocale}
      data-theme={initialMode}
      className={`${geistMono.variable} ${mplusu.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {analyticsConfig.enabled &&
        analyticsConfig.server &&
        analyticsConfig.domainId ? (
          <>
            <Script
              src={`${analyticsConfig.server}/tracker.js`}
              strategy="afterInteractive"
              onError={() => {
                console.warn('Ackee tracker script failed to load');
              }}
            />
            <AckeeRouteChangeBridge
              enabled={true}
              domainId={analyticsConfig.domainId}
            />
          </>
        ) : null}

        <AppRouterCacheProvider>
          <AppThemeProvider initialMode={initialMode}>
            <LocaleProvider
              initialLocale={initialLocale}
              initialMessages={initialMessages}
            >
              <AuthProvider>
                <SnackbarProvider>{children}</SnackbarProvider>
              </AuthProvider>
            </LocaleProvider>
          </AppThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
