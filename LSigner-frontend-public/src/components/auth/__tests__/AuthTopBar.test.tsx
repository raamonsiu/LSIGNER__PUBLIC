import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { AppThemeProvider } from '@/app/theme/ThemeContext';
import type { AbstractIntlMessages } from 'next-intl';
import { LocaleProvider, DEFAULT_LOCALE } from '@/app/locale/LocaleContext';
import enMessages from '../../../messages/en.json';

function renderWithProviders() {
  return render(
    <AppThemeProvider initialMode="dark">
      <LocaleProvider
        initialLocale={DEFAULT_LOCALE}
        initialMessages={enMessages as AbstractIntlMessages}
      >
        <AuthTopBar />
      </LocaleProvider>
    </AppThemeProvider>,
  );
}

describe('AuthTopBar', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.removeAttribute('lang');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('lang');
  });

  it('renders language switcher with three locale buttons', () => {
    renderWithProviders();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CA' })).toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    renderWithProviders();
    const toggleBtn = screen.getByRole('button', { name: '' });
    expect(toggleBtn).toBeInTheDocument();
  });

  it('toggles theme on icon button click', () => {
    renderWithProviders();
    const toggleBtn = screen.getByRole('button', { name: '' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(toggleBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
