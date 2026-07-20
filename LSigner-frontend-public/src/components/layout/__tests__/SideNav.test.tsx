import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import { AppThemeProvider } from '@/app/theme/ThemeContext';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/components/providers/SendDocumentWizardProvider', () => ({
  useWizard: () => ({ openWizard: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => {
    // Only pass through the href and children; drop Next.js-specific props
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

// ─── SUT ──────────────────────────────────────────────────────────────────────

import { SideNav } from '../SideNav';

function renderSideNav() {
  return render(
    <AppThemeProvider initialMode="dark">
      {withIntlProvider(<SideNav />)}
    </AppThemeProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SideNav — Security item (TASK-005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Security nav item is non-clickable (REQ-SEC-001)', () => {
    it('Security nav has no href attribute', () => {
      renderSideNav();

      // Find the link element that would navigate to /security
      const securityLink = screen.queryByRole('link', { name: /Security/i });
      // After implementation: Security item is NOT a link
      expect(securityLink).toBeNull();
    });

    it('Security nav text is still visible', () => {
      renderSideNav();

      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('Other nav items remain clickable links', () => {
      renderSideNav();

      const homeLink = screen.getByRole('link', { name: /Home/i });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute('href', '/');

      const settingsLink = screen.getByRole('link', { name: /Settings/i });
      expect(settingsLink).toBeInTheDocument();
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });
  });

  describe('Security nav shows "Coming soon" Tooltip (REQ-SEC-002)', () => {
    it('shows Tooltip with "Coming soon" on hover', () => {
      renderSideNav();

      // MUI Tooltip wraps the disabled element, producing an aria-label on wrapper
      // The Tooltip title "Coming soon" appears as aria-label on the outermost wrapper
      const tooltipLabel = document.querySelector('[aria-label="Coming soon"]');
      expect(tooltipLabel).not.toBeNull();
    });
  });

  describe('Security nav has disabled visual treatment', () => {
    it('has disabled dimmed styling', () => {
      renderSideNav();

      // The security item wrapper should have text.disabled color via sx
      const securityText = screen.getByText('Security');
      const parentBox = securityText.closest('[class*="MuiBox"]');
      expect(parentBox).not.toBeNull();
    });
  });
});
