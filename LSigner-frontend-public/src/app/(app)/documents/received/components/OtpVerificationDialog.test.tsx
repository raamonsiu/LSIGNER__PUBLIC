import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import OtpVerificationDialog from './OtpVerificationDialog';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  maskedDestination: 'a***h@example.com',
  isVerifying: false,
  errorMessage: null,
  resendCooldown: 0,
  canResend: true,
  onSubmit: vi.fn(),
  onResend: vi.fn(),
};

function renderDialog(props = {}) {
  return render(
    withIntlProvider(<OtpVerificationDialog {...defaultProps} {...props} />),
  );
}

describe('OtpVerificationDialog', () => {
  it('renders title from translations', () => {
    renderDialog();
    expect(screen.getByText('Verify your identity')).toBeInTheDocument();
  });

  it('renders description with masked destination', () => {
    renderDialog();
    expect(
      screen.getByText(/We sent a verification code to/),
    ).toBeInTheDocument();
    expect(screen.getByText('a***h@example.com')).toBeInTheDocument();
  });

  it('renders verification code input with label from translations', () => {
    renderDialog();
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });

  it('renders resend button text from translations when cooldown elapsed', () => {
    renderDialog({ canResend: true, resendCooldown: 0 });
    expect(screen.getByText('Resend code')).toBeInTheDocument();
  });

  it('renders resend cooldown text from translations', () => {
    renderDialog({ canResend: false, resendCooldown: 30 });
    expect(screen.getByText(/Resend available in 30s/)).toBeInTheDocument();
  });

  it('renders cancel button from translations', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders verify button text from translations', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });

  it('renders verifying text from translations when submitting', () => {
    renderDialog({ isVerifying: true });
    expect(
      screen.getByRole('button', { name: /Verifying/ }),
    ).toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    renderDialog({ errorMessage: 'Incorrect code' });
    expect(screen.getByText('Incorrect code')).toBeInTheDocument();
  });

  it('calls onSubmit when code is entered and submit clicked', () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });
    const input = screen.getByLabelText('Verification code');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });

  it('calls onResend when resend button clicked', () => {
    const onResend = vi.fn();
    renderDialog({ onResend, canResend: true });
    fireEvent.click(screen.getByText('Resend code'));
    expect(onResend).toHaveBeenCalled();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
