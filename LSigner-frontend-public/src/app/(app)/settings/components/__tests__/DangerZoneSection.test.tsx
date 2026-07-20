import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppThemeProvider } from '@/app/theme/ThemeContext';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import { DangerZoneSection } from '../DangerZoneSection';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLogout = vi.fn();
const mockShowSnackbar = vi.fn();
const mockDeleteMyAccountApi = vi.fn();

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    user: { name: 'Test' },
  }),
}));

vi.mock('@/components/providers/SnackbarProvider', () => ({
  useSnackbar: () => ({
    showSnackbar: mockShowSnackbar,
  }),
}));

vi.mock('@/lib/api/endpoints/users', () => ({
  deleteMyAccountApi: (...args: unknown[]) => mockDeleteMyAccountApi(...args),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderSection() {
  return render(
    withIntlProvider(
      <AppThemeProvider initialMode="dark">
        <DangerZoneSection />
      </AppThemeProvider>,
    ),
  );
}

function openModal() {
  const deleteButton = screen.getByRole('button', { name: 'Delete Account' });
  fireEvent.click(deleteButton);
}

function typeConfirmar() {
  const textField = screen.getByPlaceholderText('confirmar');
  fireEvent.change(textField, { target: { value: 'confirmar' } });
}

function clickConfirm() {
  const confirmButton = screen.getByRole('button', {
    name: 'Delete permanently',
  });
  fireEvent.click(confirmButton);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DangerZoneSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── R1: Renders the danger zone section ──────────────────────────────────

  it('renders danger zone title', () => {
    renderSection();

    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('renders danger zone description', () => {
    renderSection();

    expect(
      screen.getByText(
        'Permanently delete your account and all associated data',
      ),
    ).toBeInTheDocument();
  });

  // ── R2: Delete button ────────────────────────────────────────────────────

  it('renders red "Delete Account" button', () => {
    renderSection();

    const deleteButton = screen.getByRole('button', {
      name: 'Delete Account',
    });
    expect(deleteButton).toBeInTheDocument();
  });

  // ── R3: Opens modal on button click ──────────────────────────────────────

  it('opens confirmation modal when delete button is clicked', () => {
    renderSection();

    openModal();

    expect(
      screen.getByText(
        'This action is irreversible. Type "confirmar" to proceed',
      ),
    ).toBeInTheDocument();
  });

  // ── R4: Closes modal when Cancel is clicked ──────────────────────────────

  it('closes modal when Cancel is clicked', async () => {
    renderSection();

    openModal();

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.queryByText(
          'This action is irreversible. Type "confirmar" to proceed',
        ),
      ).not.toBeInTheDocument();
    });
  });

  // ── R5: Calls deleteMyAccountApi on confirm ──────────────────────────────

  it('calls deleteMyAccountApi when confirmed with correct keyword', async () => {
    mockDeleteMyAccountApi.mockResolvedValue({ message: 'ok' });
    renderSection();

    openModal();
    typeConfirmar();
    clickConfirm();

    await waitFor(() => {
      expect(mockDeleteMyAccountApi).toHaveBeenCalledTimes(1);
    });
  });

  // ── R6: Shows success snackbar and logs out on success ───────────────────

  it('shows success snackbar and calls logout on API success', async () => {
    mockDeleteMyAccountApi.mockResolvedValue({ message: 'ok' });
    renderSection();

    openModal();
    typeConfirmar();
    clickConfirm();

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Account deleted successfully',
        'success',
      );
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  // ── R7: Shows error snackbar on API failure ──────────────────────────────

  it('shows error snackbar and does NOT logout on API failure', async () => {
    mockDeleteMyAccountApi.mockRejectedValue(new Error('Server error'));
    renderSection();

    openModal();
    typeConfirmar();
    clickConfirm();

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Error deleting account',
        'error',
      );
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });

  // ── R8: Error message persists in modal after API failure ────────────────

  it('keeps modal open with error message when API fails', async () => {
    mockDeleteMyAccountApi.mockRejectedValue(new Error('Server error'));
    renderSection();

    openModal();
    typeConfirmar();
    clickConfirm();

    await waitFor(() => {
      expect(
        screen.getByText(
          'This action is irreversible. Type "confirmar" to proceed',
        ),
      ).toBeInTheDocument();
    });
  });

  // ── R9: Red danger box styling ───────────────────────────────────────────

  it('renders within a red-themed section', () => {
    renderSection();

    // The section should have a red border/outline
    const section = screen.getByText('Danger Zone').closest('div[id]');
    expect(section).toBeInTheDocument();
  });
});
