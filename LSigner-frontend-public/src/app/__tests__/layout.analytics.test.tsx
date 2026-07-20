import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const cookiesMock = vi.fn();
const parseAckeeAnalyticsConfigMock = vi.fn();

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('next/font/google', () => ({
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}));

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mplusu' }),
}));

vi.mock('@mui/material-nextjs/v16-appRouter', () => ({
  AppRouterCacheProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/app/theme/ThemeContext', () => ({
  AppThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/app/locale', () => ({
  LocaleProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/lib/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/components/providers/SnackbarProvider', () => ({
  SnackbarProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/lib/analytics/ackeeConfig', () => ({
  parseAckeeAnalyticsConfig: parseAckeeAnalyticsConfigMock,
}));

vi.mock('next/script', () => ({
  default: ({
    src,
    onError,
  }: {
    src: string;
    onError?: React.ReactEventHandler<HTMLScriptElement>;
  }) => (
    <>
      <script data-testid="ackee-script" data-src={src} />
      <button
        type="button"
        data-testid="ackee-script-error-trigger"
        onClick={() => {
          onError?.({
            type: 'error',
          } as React.SyntheticEvent<HTMLScriptElement>);
        }}
      >
        trigger-error
      </button>
    </>
  ),
}));

vi.mock('@/components/providers/AckeeRouteChangeBridge', () => ({
  AckeeRouteChangeBridge: ({ domainId }: { domainId: string }) => (
    <div data-testid="ackee-bridge" data-domain-id={domainId} />
  ),
}));

describe('RootLayout analytics wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    cookiesMock.mockResolvedValue({
      get: (key: string) => {
        if (key === 'theme') {
          return { value: 'dark' };
        }

        if (key === 'locale') {
          return { value: 'en' };
        }

        return undefined;
      },
    });
  });

  it('loads Ackee script and bridge when analytics config is enabled', async () => {
    parseAckeeAnalyticsConfigMock.mockReturnValue({
      enabled: true,
      server: 'https://ackee.example.com',
      domainId: '550e8400-e29b-41d4-a716-446655440000',
      disableReason: null,
    });

    const { default: RootLayout } = await import('../layout');
    const ui = await RootLayout({
      children: <div data-testid="layout-child">content</div>,
    });

    render(ui);

    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
    expect(screen.getByTestId('ackee-script')).toHaveAttribute(
      'data-src',
      'https://ackee.example.com/tracker.js',
    );
    expect(screen.getByTestId('ackee-bridge')).toHaveAttribute(
      'data-domain-id',
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('keeps route rendering non-blocking when tracker script loading fails at runtime', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop for test assertions
    });

    parseAckeeAnalyticsConfigMock.mockReturnValue({
      enabled: true,
      server: 'https://ackee.example.com',
      domainId: '550e8400-e29b-41d4-a716-446655440000',
      disableReason: null,
    });

    const { default: RootLayout } = await import('../layout');
    const ui = await RootLayout({
      children: <div data-testid="layout-child">content</div>,
    });

    render(ui);

    fireEvent.click(screen.getByTestId('ackee-script-error-trigger'));

    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Ackee tracker script failed to load',
    );

    consoleWarnSpy.mockRestore();
  });

  it('keeps rendering non-blocking when analytics is disabled', async () => {
    parseAckeeAnalyticsConfigMock.mockReturnValue({
      enabled: false,
      server: null,
      domainId: null,
      disableReason: 'missing',
    });

    const { default: RootLayout } = await import('../layout');
    const ui = await RootLayout({
      children: <div data-testid="layout-child">content</div>,
    });

    render(ui);

    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
    expect(screen.queryByTestId('ackee-script')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ackee-bridge')).not.toBeInTheDocument();
  });

  it.each(['invalid_server', 'invalid_domain'] as const)(
    'keeps rendering non-blocking when analytics is disabled by %s',
    async (disableReason) => {
      parseAckeeAnalyticsConfigMock.mockReturnValue({
        enabled: false,
        server: null,
        domainId: null,
        disableReason,
      });

      const { default: RootLayout } = await import('../layout');
      const ui = await RootLayout({
        children: <div data-testid="layout-child">content</div>,
      });

      render(ui);

      expect(screen.getByTestId('layout-child')).toBeInTheDocument();
      expect(screen.queryByTestId('ackee-script')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ackee-bridge')).not.toBeInTheDocument();
    },
  );
});
