import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { AbstractIntlMessages } from 'next-intl';
import { LocaleProvider, DEFAULT_LOCALE } from './LocaleContext';
import enMessages from '../../messages/en.json';

function renderWithProvider(initialLocale: string = DEFAULT_LOCALE) {
  return render(
    <LocaleProvider
      initialLocale={initialLocale as 'en' | 'es' | 'ca'}
      initialMessages={enMessages as AbstractIntlMessages}
    >
      <LanguageSwitcher />
    </LocaleProvider>,
  );
}

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('lang');
    document.cookie = 'locale=; path=/; max-age=0';
  });

  afterEach(() => {
    document.documentElement.removeAttribute('lang');
    document.cookie = 'locale=; path=/; max-age=0';
  });

  it('renders buttons for all three locales', () => {
    renderWithProvider();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CA' })).toBeInTheDocument();
  });

  it('highlights the active locale', () => {
    renderWithProvider('en');
    const enBtn = screen.getByRole('button', { name: 'EN' });
    expect(enBtn).toHaveStyle('fontWeight: 700');
  });

  it('does not highlight inactive locales', () => {
    renderWithProvider('en');
    const esBtn = screen.getByRole('button', { name: 'ES' });
    expect(esBtn).toHaveStyle('fontWeight: 500');
  });

  it('switches locale on click', () => {
    renderWithProvider('en');
    fireEvent.click(screen.getByRole('button', { name: 'ES' }));
    expect(screen.getByRole('button', { name: 'ES' })).toHaveStyle(
      'fontWeight: 700',
    );
    expect(screen.getByRole('button', { name: 'EN' })).toHaveStyle(
      'fontWeight: 500',
    );
  });

  it('switches to Catalan and persists cookie', () => {
    renderWithProvider('en');
    fireEvent.click(screen.getByRole('button', { name: 'CA' }));
    expect(document.cookie).toMatch(/(?:^|;\s*)locale=ca/);
    expect(screen.getByRole('button', { name: 'CA' })).toHaveStyle(
      'fontWeight: 700',
    );
  });
});
