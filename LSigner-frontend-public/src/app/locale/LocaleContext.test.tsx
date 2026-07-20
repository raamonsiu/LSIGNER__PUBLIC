import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  LocaleProvider,
  useLocaleContext,
  getInitialLocale,
  DEFAULT_LOCALE,
} from './LocaleContext';
import { useTranslations } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import enMessages from '../../messages/en.json';

function Probe() {
  const { locale, setLocale } = useLocaleContext();
  const translations = useTranslations('common');
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{translations('brand.subtitle')}</span>
      <button onClick={() => setLocale('en')}>set-en</button>
      <button onClick={() => setLocale('es')}>set-es</button>
      <button onClick={() => setLocale('ca')}>set-ca</button>
    </div>
  );
}

function renderWith(
  initialLocale: string = DEFAULT_LOCALE,
  initialMessages?: AbstractIntlMessages,
) {
  return render(
    <LocaleProvider
      initialLocale={initialLocale as 'en' | 'es' | 'ca'}
      initialMessages={initialMessages ?? (enMessages as AbstractIntlMessages)}
    >
      <Probe />
    </LocaleProvider>,
  );
}

describe('LocaleProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('lang');
    document.cookie = 'locale=; path=/; max-age=0';
  });

  afterEach(() => {
    document.documentElement.removeAttribute('lang');
    document.cookie = 'locale=; path=/; max-age=0';
  });

  it('renders with the initialLocale prop', () => {
    renderWith('en');
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });

  it('renders with Spanish as initial locale', () => {
    renderWith('es');
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  it('setLocale updates React state', () => {
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: 'set-es' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  it('setLocale writes the locale cookie', () => {
    renderWith('en');
    fireEvent.click(screen.getByRole('button', { name: 'set-es' }));
    expect(document.cookie).toMatch(/(?:^|;\s*)locale=es/);
  });

  it('setLocale updates the html lang attribute on switch', () => {
    renderWith('en');
    expect(document.documentElement.getAttribute('lang')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'set-es' }));
    expect(document.documentElement.getAttribute('lang')).toBe('es');
  });

  it('setLocale switches to Catalan and persists', () => {
    renderWith('en');

    fireEvent.click(screen.getByRole('button', { name: 'set-ca' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('ca');
    expect(document.cookie).toMatch(/(?:^|;\s*)locale=ca/);
    expect(document.documentElement.getAttribute('lang')).toBe('ca');

    fireEvent.click(screen.getByRole('button', { name: 'set-en' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(document.cookie).toMatch(/(?:^|;\s*)locale=en/);
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('useLocaleContext throws when used outside the provider', () => {
    function Naked() {
      useLocaleContext();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Naked />)).toThrow(
      /must be used within a LocaleProvider/,
    );
    spy.mockRestore();
  });

  it('loads messages for the selected locale and updates translations', async () => {
    renderWith('en');

    expect(screen.getByTestId('translated')).toHaveTextContent(
      'Electronic Signature Provider',
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-es' }));

    await waitFor(() => {
      expect(screen.getByTestId('translated')).toHaveTextContent(
        'Proveedor de Firma Electrónica',
      );
    });
  });
});

describe('getInitialLocale', () => {
  beforeAll(() => {
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });
  });

  afterEach(() => {
    document.cookie = 'locale=; path=/; max-age=0';
  });

  it('returns DEFAULT_LOCALE when no cookie is set', () => {
    expect(getInitialLocale()).toBe(DEFAULT_LOCALE);
  });

  it('returns the locale from cookie when valid', () => {
    document.cookie = 'locale=ca; path=/; max-age=31536000';
    expect(getInitialLocale()).toBe('ca');
  });

  it('returns DEFAULT_LOCALE when cookie has invalid value', () => {
    document.cookie = 'locale=fr; path=/; max-age=31536000';
    expect(getInitialLocale()).toBe(DEFAULT_LOCALE);
  });

  it('returns DEFAULT_LOCALE when navigator.language is not supported', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'fr-FR',
      configurable: true,
    });
    expect(getInitialLocale()).toBe(DEFAULT_LOCALE);
  });
});
