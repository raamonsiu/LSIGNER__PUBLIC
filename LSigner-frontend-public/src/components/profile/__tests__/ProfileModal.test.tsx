import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseAuth = vi.fn();
const mockLogout = vi.fn();

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── SUT ──────────────────────────────────────────────────────────────────────

import { ProfileModal } from '../ProfileModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FULL_USER = {
  patient_id: 'P-12345',
  name: 'John',
  last_name: 'Doe',
  country: 'Spain',
  national_id: '12345678Z',
  passport: 'AB123456',
  email: 'john@example.com',
  phone_number: '+34600000000',
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2025-06-01T14:22:00.000Z',
};

const NULLABLE_NULL_USER = {
  ...FULL_USER,
  national_id: null,
  passport: null,
};

function renderModal(overrides = {}) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onEditInfo: vi.fn(),
    ...overrides,
  };
  return {
    ...defaultProps,
    ...render(withIntlProvider(<ProfileModal {...defaultProps} />)),
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

// Design: 6 spec-mapped test cases
// 2.1 -> full user renders all 11 fields + 3 section headers
// 2.2 -> null national_id / passport -> `—` placeholder
// 2.3 -> isSessionRestored=false -> skeleton (no field values)
// 2.4 -> "Edit info" click -> onEditInfo() called exactly once
// 2.5 -> ESC / backdrop-click / X-button -> onClose() called
// 2.6 -> i18n labels derived from real profile namespace keys

describe('ProfileModal', () => {
  describe('2.1 — full user renders all fields grouped by section', () => {
    it('renders three section headers', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      renderModal();

      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Account Information')).toBeInTheDocument();
    });

    it('renders all personal_info fields with values', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      renderModal();

      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();
      expect(screen.getByText('Spain')).toBeInTheDocument();
      expect(screen.getByText('12345678Z')).toBeInTheDocument();
      expect(screen.getByText('AB123456')).toBeInTheDocument();
    });

    it('renders all contact_info fields with values', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      renderModal();

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('+34600000000')).toBeInTheDocument();
    });

    it('renders all account_info fields with values', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      renderModal();

      expect(screen.getByText('P-12345')).toBeInTheDocument();
      // Dates formatted via toLocaleDateString — verify the formatted output
      expect(
        screen.getByText(
          new Date('2024-01-15T10:30:00.000Z').toLocaleDateString(),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          new Date('2025-06-01T14:22:00.000Z').toLocaleDateString(),
        ),
      ).toBeInTheDocument();
    });
  });

  describe('2.2 — null national_id and passport render placeholder', () => {
    it('shows em-dash for null national_id', () => {
      mockUseAuth.mockReturnValue({
        user: NULLABLE_NULL_USER,
        isSessionRestored: true,
      });
      renderModal();

      // Both null fields should render "—"
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2.3 — loading skeleton when session not restored', () => {
    it('shows skeleton, hides field values', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isSessionRestored: false,
      });
      renderModal();

      // Skeleton should be present (MUI Skeleton has role="progressbar" by default-ish,
      // or we can check for CSS animation / specific test-id)
      expect(screen.queryByText('John')).not.toBeInTheDocument();
      expect(screen.queryByText('Doe')).not.toBeInTheDocument();
      // The dialog should still be present
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('2.4 — Edit info click fires onEditInfo', () => {
    it('calls onEditInfo once and does not call onClose', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      const { onEditInfo, onClose } = renderModal();

      const editBtn = screen.getByText('Edit info');
      fireEvent.click(editBtn);

      expect(onEditInfo).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('2.5 — dismissal: ESC, backdrop, X each fire onClose', () => {
    it('closes on ESC key', async () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      const { onClose } = renderModal();

      fireEvent.keyDown(screen.getByRole('dialog'), {
        key: 'Escape',
        code: 'Escape',
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on backdrop click', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      const { onClose } = renderModal();

      // MUI renders backdrop as the last element inside the presentation layer;
      // we can access it via the aria-hidden backdrop div.
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on X button', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      const { onClose } = renderModal();

      const closeBtn = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('2.6 — i18n labels resolve from profile namespace', () => {
    it('renders field labels from i18n profile keys', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      renderModal();

      // These keys map to English labels via en.json profile namespace
      expect(screen.getByText('First Name')).toBeInTheDocument();
      expect(screen.getByText('Last Name')).toBeInTheDocument();
      expect(screen.getByText('Patient ID')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Country')).toBeInTheDocument();
      expect(screen.getByText('DNI / NIF')).toBeInTheDocument();
      expect(screen.getByText('Passport')).toBeInTheDocument();
      expect(screen.getByText('Member since')).toBeInTheDocument();
      expect(screen.getByText('Last updated')).toBeInTheDocument();
    });

    it('renders edit_info label from i18n', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
      });
      renderModal();

      expect(screen.getByText('Edit info')).toBeInTheDocument();
    });
  });

  describe('logout button', () => {
    it('renders Log out button in DialogActions', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
        logout: mockLogout,
      });
      renderModal();

      expect(screen.getByText('Log out')).toBeInTheDocument();
    });

    it('calls logout when Log out button is clicked', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
        logout: mockLogout,
      });
      renderModal();

      const logoutBtn = screen.getByText('Log out');
      fireEvent.click(logoutBtn);

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('renders Log out button before Edit info button', () => {
      mockUseAuth.mockReturnValue({
        user: FULL_USER,
        isSessionRestored: true,
        logout: mockLogout,
      });
      renderModal();

      const buttons = screen.getAllByRole('button');
      // DialogActions should have: Close (X), Log out, Edit info
      const logoutIndex = buttons.findIndex((b) => b.textContent === 'Log out');
      const editIndex = buttons.findIndex((b) => b.textContent === 'Edit info');
      expect(logoutIndex).toBeGreaterThan(-1);
      expect(editIndex).toBeGreaterThan(-1);
      expect(logoutIndex).toBeLessThan(editIndex);
    });

    it('does not render Log out when session is not restored', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isSessionRestored: false,
        logout: mockLogout,
      });
      renderModal();

      expect(screen.queryByText('Log out')).not.toBeInTheDocument();
    });
  });
});
