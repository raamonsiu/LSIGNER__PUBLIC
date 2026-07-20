import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import { AppThemeProvider } from '@/app/theme/ThemeContext';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

const mockUseAuth = vi.fn();

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/app/(app)/settings/SettingsContext', () => ({
  useSettingsContext: () => ({ activeSection: null }),
}));

// ─── SUT ──────────────────────────────────────────────────────────────────────

import { TopBar } from '../TopBar';

// ─── Test user fixtures (RED phase — differ from mockCurrentUser) ─────────────
// mockCurrentUser = { name: 'Adrián', last_name: 'García Martínez' }
// These fixtures produce DIFFERENT output so RED tests genuinely fail.

const RED_USER = {
  patient_id: 'P-RED',
  name: 'Carlos',
  last_name: 'Ruiz Gómez',
  country: 'Spain',
  national_id: null,
  passport: null,
  email: 'carlos@example.com',
  phone_number: '+34600000001',
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2025-06-01T14:22:00.000Z',
};

const MARIA_USER = {
  ...RED_USER,
  name: 'María',
  last_name: 'Pérez',
};

// ─── Render helper ────────────────────────────────────────────────────────────

function renderTopBar(props = {}) {
  return render(
    <AppThemeProvider initialMode="dark">
      {withIntlProvider(<TopBar {...props} />)}
    </AppThemeProvider>,
  );
}

/** Find the bell button by its icon testid, then climb to the button. */
function getBellButton() {
  const bellIcon = screen.getByTestId('NotificationsOutlinedIcon');
  return bellIcon.closest('button')!;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated user with session restored
  mockUseAuth.mockReturnValue({
    user: RED_USER,
    isAuthenticated: true,
    isSessionRestored: true,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// R1 — Disabled Notification Bell
// ═══════════════════════════════════════════════════════════════════════════════

describe('R1 — Disabled Notification Bell', () => {
  // 2.1: Badge component absent from DOM (R1-S1)
  it('does not render a Badge count badge', () => {
    renderTopBar();
    const badgeElements = document.querySelectorAll('.MuiBadge-badge');
    // Current code RENDERS a Badge with badgeContent={2}.
    // After implementation, Badge is removed -> 0 badge elements.
    expect(badgeElements.length).toBe(0);
  });

  // 2.2: Bell IconButton has disabled attribute (R1-S1)
  it('renders the bell button as disabled', () => {
    renderTopBar();
    const bell = getBellButton();
    // Current bell is NOT disabled -> this MUST fail in RED.
    expect(bell).toBeDisabled();
  });

  // 2.3: Bell icon is visibly present despite disabled state (R1-S2)
  it('renders the bell icon visibly (not hidden)', () => {
    renderTopBar();
    const bell = getBellButton();
    // Current bell is enabled, so it's visible.
    // After implementation with disabled+Tooltip, the icon must still be visible.
    // For RED: current bell button is queryable -> passes for wrong reason.
    // The disabled assertion (2.2) is the one that must fail.
    expect(bell).toBeInTheDocument();
    // Verify the NotificationsOutlinedIcon is inside it
    const icon = within(bell).getByTestId('NotificationsOutlinedIcon');
    expect(icon).toBeInTheDocument();
  });

  // 2.4: Disabled state prevents hover color change (R1-S3)
  it('prevents hover color change via disabled state', () => {
    renderTopBar();
    const bell = getBellButton();
    // Primary mechanism: button is disabled.
    // Current: NOT disabled -> RED failure.
    expect(bell).toBeDisabled();
    // MUI's disabled state suppresses :hover styles via Mui-disabled class.
    expect(bell.classList.contains('Mui-disabled')).toBe(true);
    expect(bell).toHaveAttribute('disabled');
  });

  // 2.5: Clicking bell triggers no navigation/modal (R1-S4)
  it('does not trigger any action on click', () => {
    renderTopBar();
    const bell = getBellButton();
    // Current bell has no onClick, so click is benign.
    // After implementation: disabled button absorbs click.
    // Regression test — should pass both before and after.
    expect(() => fireEvent.click(bell)).not.toThrow();
    // Verify no modal/dialog appeared (there isn't one)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  // 2.6: Tooltip renders with localized "Notifications coming soon" (R1-S5)
  it('shows a Tooltip with "Notifications coming soon" on hover', () => {
    renderTopBar();
    const bell = getBellButton();

    // Trigger the Tooltip via the parent span
    const tooltipWrapper = bell.parentElement!;
    fireEvent.mouseOver(tooltipWrapper);
    fireEvent.focus(tooltipWrapper);

    // MUI Tooltip with disabled child renders title as aria-label on wrapper span
    const tooltipLabel =
      screen.queryByRole('tooltip') ??
      document.querySelector('[aria-label="Notifications coming soon"]');
    expect(tooltipLabel).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// R2 — Real User from AuthContext
// ═══════════════════════════════════════════════════════════════════════════════

describe('R2 — Real User from AuthContext', () => {
  // 2.7: Display name "Carlos Ruiz" and Avatar initials "CR" from useAuth
  it('displays the authenticated user name from useAuth', () => {
    renderTopBar();
    // RED_USER: "Carlos Ruiz", initials "CR".
    // Current code shows mockCurrentUser: "Adrián García", initials "AG".
    // This test MUST fail in RED because names differ.
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
    expect(screen.getByText('CR')).toBeInTheDocument();
  });

  // 2.8: Display name "María Pérez" and initials "MP" for single last name
  it('displays user with single last name correctly', () => {
    mockUseAuth.mockReturnValue({
      user: MARIA_USER,
      isAuthenticated: true,
      isSessionRestored: true,
    });
    renderTopBar();
    // MARIA_USER: "María Pérez", initials "MP".
    // Current code shows mockCurrentUser: "Adrián García", initials "AG".
    // This test MUST fail in RED because names differ.
    expect(screen.getByText('María Pérez')).toBeInTheDocument();
    expect(screen.getByText('MP')).toBeInTheDocument();
  });

  // 2.9: Null user renders empty strings without crash (R2-S3)
  it('renders empty strings when user is null without crashing', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isSessionRestored: false,
    });
    // Must not throw when rendering
    expect(() => renderTopBar()).not.toThrow();

    // After implementation: null user -> empty display name.
    // Currently: mockCurrentUser -> "Adrián García" is present.
    // RED assertion: mockCurrentUser-derived names should NOT appear
    // when useAuth has null user. Current code ALWAYS shows mockCurrentUser,
    // so regex match finds "Adrián" -> NOT null -> FAILS in RED.
    expect(screen.queryByText(/Adrián/)).toBeNull();
    expect(screen.queryByText(/García/)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// R3 — Separator Preserved
// ═══════════════════════════════════════════════════════════════════════════════
// R4 — Accessibility
// ═══════════════════════════════════════════════════════════════════════════════

describe('R4 — Accessibility', () => {
  // 2.11: Bell has aria-label="Notifications unavailable" (R4-S1)
  it('has aria-label on the disabled bell', () => {
    renderTopBar();
    const bell = getBellButton();
    // Current bell has NO aria-label -> RED failure.
    expect(bell).toHaveAttribute('aria-label', 'Notifications unavailable');
  });

  // 2.12: Avatar aria-label contains user initials (R4-S2)
  it('renders Avatar with aria-label containing user initials', () => {
    renderTopBar();
    // MUI Avatar with text children renders as a <div>, not <img>.
    // The a11y spec is satisfied via aria-label containing initials.
    const avatar = document.querySelector('[aria-label*="CR"]');
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveAttribute('aria-label', 'CR');
  });
});
