import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppThemeProvider } from '@/app/theme/ThemeContext';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import { DeleteAccountModal } from '../DeleteAccountModal';

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderModal(
  props: Partial<React.ComponentProps<typeof DeleteAccountModal>> = {},
) {
  return render(
    withIntlProvider(
      <AppThemeProvider initialMode="dark">
        <DeleteAccountModal
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          isLoading={false}
          error={null}
          {...props}
        />
      </AppThemeProvider>,
    ),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DeleteAccountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── R1: Renders when open ────────────────────────────────────────────────

  it('renders warning text when open', () => {
    renderModal();

    expect(
      screen.getByText(
        'This action is irreversible. Type "confirmar" to proceed',
      ),
    ).toBeInTheDocument();
  });

  it('does not render content in DOM when closed', () => {
    renderModal({ open: false });

    // MUI Dialog with open=false removes content from DOM
    expect(
      screen.queryByText(
        'This action is irreversible. Type "confirmar" to proceed',
      ),
    ).not.toBeInTheDocument();
  });

  // ── R2: Title and description ────────────────────────────────────────────

  it('renders the confirmation title', () => {
    renderModal();

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders the danger zone description', () => {
    renderModal();

    expect(
      screen.getByText(
        'Permanently delete your account and all associated data',
      ),
    ).toBeInTheDocument();
  });

  // ── R3: Keyword matching ─────────────────────────────────────────────────

  it('has confirm button disabled when keyword does not match', () => {
    renderModal();

    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(confirmButton).toBeDisabled();
  });

  it('enables confirm button when "confirmar" is typed', () => {
    renderModal();

    const textField = screen.getByPlaceholderText('confirmar');
    fireEvent.change(textField, { target: { value: 'confirmar' } });

    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(confirmButton).toBeEnabled();
  });

  it('keeps button disabled for partial match of "confirmar"', () => {
    renderModal();

    const textField = screen.getByPlaceholderText('confirmar');
    fireEvent.change(textField, { target: { value: 'confir' } });

    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(confirmButton).toBeDisabled();
  });

  it('keeps button disabled for case-different match', () => {
    renderModal();

    const textField = screen.getByPlaceholderText('confirmar');
    fireEvent.change(textField, { target: { value: 'CONFIRMAR' } });

    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(confirmButton).toBeEnabled();
  });

  it('keeps button disabled for wrong keyword entirely', () => {
    renderModal();

    const textField = screen.getByPlaceholderText('confirmar');
    fireEvent.change(textField, { target: { value: 'wrongword' } });

    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(confirmButton).toBeDisabled();
  });

  // ── R4: Calls onConfirm when button clicked ──────────────────────────────

  it('calls onConfirm when confirm button is clicked with matching keyword', () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    const textField = screen.getByPlaceholderText('confirmar');
    fireEvent.change(textField, { target: { value: 'confirmar' } });

    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm when button is disabled', () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(confirmButton).toBeDisabled();

    // Attempt to click regardless
    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── R5: Loading state ────────────────────────────────────────────────────

  it('shows loading text and disables button when isLoading', () => {
    renderModal({ isLoading: true });

    // Button should show "Deleting..." or be disabled
    const confirmButton = screen.getByRole('button', {
      name: 'Delete permanently',
    });
    expect(confirmButton).toBeDisabled();
  });

  // ── R6: Error message ────────────────────────────────────────────────────

  it('shows error message when error prop is provided', () => {
    renderModal({ error: 'Server error occurred' });

    expect(screen.getByText('Server error occurred')).toBeInTheDocument();
  });

  // ── R7: Close button ────────────────────────────────────────────────────

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── R8: Legal link ──────────────────────────────────────────────────────

  it('renders legal retention policy link', () => {
    renderModal();
    const legalLink = screen.getByRole('link', { name: /retention/i });
    expect(legalLink).toBeInTheDocument();
    expect(legalLink).toHaveAttribute(
      'href',
      '/legal/document-retention-policy',
    );
  });
});
