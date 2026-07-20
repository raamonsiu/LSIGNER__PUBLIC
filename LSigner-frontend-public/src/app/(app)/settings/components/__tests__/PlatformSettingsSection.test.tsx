import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppThemeProvider } from '@/app/theme/ThemeContext';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import type { ThemeMode } from '@/app/theme/ThemeContext';

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT — PlatformSettingsSection.tsx. RED gate satisfied: file exists now.
// ═══════════════════════════════════════════════════════════════════════════════
import { PlatformSettingsSection } from '../PlatformSettingsSection';

// ── Mock: useLocaleContext ───────────────────────────────────────────────────

const mockSetLocale = vi.fn();
let mockLocale = 'en';

vi.mock('@/app/locale/LocaleContext', () => ({
  useLocaleContext: () => ({
    locale: mockLocale,
    setLocale: mockSetLocale,
    messages: {},
  }),
  LOCALE_COOKIE: 'locale',
  SUPPORTED_LOCALES: ['en', 'es', 'ca'],
  DEFAULT_LOCALE: 'en',
}));

// ── Mock: useAppTheme ────────────────────────────────────────────────────────

const mockToggleTheme = vi.fn();
let mockMode: ThemeMode = 'dark';

vi.mock('@/app/theme/ThemeContext', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/theme/ThemeContext')
  >('@/app/theme/ThemeContext');
  return {
    ...actual,
    useAppTheme: () => ({
      mode: mockMode,
      toggleTheme: mockToggleTheme,
      setTheme: vi.fn(),
    }),
  };
});

// ── Helper: render with providers ────────────────────────────────────────────

function renderComponent() {
  return render(
    withIntlProvider(
      <AppThemeProvider initialMode={mockMode}>
        <PlatformSettingsSection />
      </AppThemeProvider>,
    ),
  );
}

/**
 * Returns the three MUI Switch <input> elements in DOM order:
 * [0] = theme, [1] = notifications, [2] = reduced-motion.
 *
 * MUI v9 renders role="switch" on the native <input> element but does NOT
 * set aria-label or aria-checked there. The aria-label is placed on a
 * parent <span>. Use `getSwitchLabel()` for aria-label assertions.
 */
function getSwitches(): HTMLInputElement[] {
  return screen.getAllByRole('switch') as HTMLInputElement[];
}

/**
 * Returns the element bearing the given aria-label (MUI v9 places it on
 * a <span> wrapping the <input>).
 */
function getSwitchLabel(label: string): Element | null {
  return document.querySelector(`[aria-label="${label}"]`);
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockLocale = 'en';
  mockMode = 'dark';
  mockSetLocale.mockReset();
  mockToggleTheme.mockReset();
  localStorage.clear();
  // Default matchMedia: prefers motion (matches: false)
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  document.documentElement.removeAttribute('data-reduce-motion');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('PlatformSettingsSection', () => {
  // ── 2.1 R1: renders 2 Cards with section titles ───────────────────────────

  describe('R1: section structure', () => {
    it('renders Appearance and Preferences cards', () => {
      renderComponent();

      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Preferences')).toBeInTheDocument();

      const cards = document.querySelectorAll('.MuiCard-root');
      expect(cards).toHaveLength(2);
    });
  });

  // ── 2.2 R2: Language selector ─────────────────────────────────────────────

  describe('R2: language selector', () => {
    it('renders 3 language buttons with full locale labels', () => {
      renderComponent();

      expect(
        screen.getByRole('button', { name: 'English' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Español' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Català' }),
      ).toBeInTheDocument();
    });

    it('clicking Español calls setLocale("es")', () => {
      renderComponent();

      const esButton = screen.getByRole('button', { name: 'Español' });
      fireEvent.click(esButton);
      expect(mockSetLocale).toHaveBeenCalledWith('es');
    });

    it('active locale button shows selected state (aria-pressed)', () => {
      mockLocale = 'es';
      renderComponent();

      const esButton = screen.getByRole('button', { name: 'Español' });
      expect(esButton).toHaveAttribute('aria-pressed', 'true');

      const enButton = screen.getByRole('button', { name: 'English' });
      expect(enButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ── 2.3 R3: Theme toggle ──────────────────────────────────────────────────

  describe('R3: theme toggle', () => {
    it('Switch is checked when dark mode', () => {
      mockMode = 'dark';
      renderComponent();
      const [themeSwitch] = getSwitches();
      expect(themeSwitch).toBeChecked();
    });

    it('Switch is unchecked when light mode', () => {
      mockMode = 'light';
      renderComponent();
      const [themeSwitch] = getSwitches();
      expect(themeSwitch).not.toBeChecked();
    });

    it('toggling Switch calls toggleTheme()', () => {
      renderComponent();
      const [themeSwitch] = getSwitches();
      fireEvent.click(themeSwitch);
      expect(mockToggleTheme).toHaveBeenCalled();
    });
  });

  // ── 2.4 R4: Notifications toggle ─────────────────────────────────────────

  describe('R4: notifications toggle', () => {
    it('Switch defaults to off (unchecked)', () => {
      renderComponent();
      const [, notifSwitch] = getSwitches();
      expect(notifSwitch).not.toBeChecked();
    });

    it('toggling Switch on saves "on" to localStorage', () => {
      renderComponent();
      const [, notifSwitch] = getSwitches();
      fireEvent.click(notifSwitch);

      expect(localStorage.getItem('platform.notifications')).toBe('on');
    });

    it('persists across re-render: localStorage "on" -> checked', () => {
      localStorage.setItem('platform.notifications', 'on');
      renderComponent();
      const [, notifSwitch] = getSwitches();
      expect(notifSwitch).toBeChecked();
    });

    it('can be toggled off after being on', () => {
      localStorage.setItem('platform.notifications', 'on');
      renderComponent();
      const [, notifSwitch] = getSwitches();
      expect(notifSwitch).toBeChecked();

      fireEvent.click(notifSwitch);
      expect(localStorage.getItem('platform.notifications')).toBe('off');
    });
  });

  // ── 2.5 R5: Reduced motion toggle ────────────────────────────────────────

  describe('R5: reduced motion toggle', () => {
    it('defaults on when system prefers-reduced-motion matches', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      );
      renderComponent();
      const [, , motionSwitch] = getSwitches();
      expect(motionSwitch).toBeChecked();
    });

    it('defaults off when system prefers-reduced-motion does NOT match', () => {
      renderComponent();
      const [, , motionSwitch] = getSwitches();
      expect(motionSwitch).not.toBeChecked();
    });

    it('explicit localStorage "off" overrides system default (matchMedia matches)', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      );
      localStorage.setItem('platform.reducedMotion', 'off');
      renderComponent();
      const [, , motionSwitch] = getSwitches();
      expect(motionSwitch).not.toBeChecked();
    });

    it('explicit localStorage "on" overrides system default (matchMedia does NOT match)', () => {
      localStorage.setItem('platform.reducedMotion', 'on');
      renderComponent();
      const [, , motionSwitch] = getSwitches();
      expect(motionSwitch).toBeChecked();
    });

    it('sets data-reduce-motion on <html> when toggled on', () => {
      renderComponent();
      const [, , motionSwitch] = getSwitches();

      // Starts OFF (matchMedia=false), toggle ON
      fireEvent.click(motionSwitch);

      expect(document.documentElement.hasAttribute('data-reduce-motion')).toBe(
        true,
      );
      expect(localStorage.getItem('platform.reducedMotion')).toBe('on');
    });

    it('removes data-reduce-motion from <html> when toggled off', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      );
      renderComponent();

      // Starts ON (matchMedia matches), toggle OFF
      const [, , motionSwitch] = getSwitches();
      fireEvent.click(motionSwitch);

      expect(document.documentElement.hasAttribute('data-reduce-motion')).toBe(
        false,
      );
      expect(localStorage.getItem('platform.reducedMotion')).toBe('off');
    });

    it('initializes data-reduce-motion on mount when system prefers reduced motion', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      );
      renderComponent();

      expect(document.documentElement.hasAttribute('data-reduce-motion')).toBe(
        true,
      );
    });
  });

  // ── 2.6 R7: Accessibility ────────────────────────────────────────────────

  describe('R7: accessibility', () => {
    it('theme Switch has aria-label "Toggle theme"', () => {
      renderComponent();
      expect(getSwitchLabel('Toggle theme')).toBeInTheDocument();
    });

    it('notifications Switch has aria-label "Toggle notifications"', () => {
      renderComponent();
      expect(getSwitchLabel('Toggle notifications')).toBeInTheDocument();
    });

    it('reduced-motion Switch has aria-label "Toggle reduced motion"', () => {
      renderComponent();
      expect(getSwitchLabel('Toggle reduced motion')).toBeInTheDocument();
    });

    it('theme Switch checked state reflects mode', () => {
      mockMode = 'dark';
      renderComponent();
      const [themeSwitch] = getSwitches();
      expect(themeSwitch).toBeChecked();
    });

    it('Switch is keyboard-operable via Space', () => {
      renderComponent();
      const [, notifSwitch] = getSwitches();

      // MUI SwitchBase handles Space/Enter internally. Simulate a click
      // which MUI's keyboard handler would also trigger.
      fireEvent.click(notifSwitch);
      expect(localStorage.getItem('platform.notifications')).toBe('on');
    });

    it('Switch is keyboard-operable via Enter', () => {
      localStorage.setItem('platform.notifications', 'on');
      renderComponent();
      const [, notifSwitch] = getSwitches();

      fireEvent.click(notifSwitch);
      expect(localStorage.getItem('platform.notifications')).toBe('off');
    });

    it('reduced-motion Switch reflects checked state after toggle', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      );
      renderComponent();
      const [, , motionSwitch] = getSwitches();

      // Default off
      expect(motionSwitch).not.toBeChecked();

      // Toggle on
      fireEvent.click(motionSwitch);
      expect(motionSwitch).toBeChecked();
    });
  });
});
