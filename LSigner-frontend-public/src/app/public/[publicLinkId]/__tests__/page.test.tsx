import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@/app/theme/muiTheme';
import type { PublicDocumentMeResponse } from '@/lib/api/endpoints/types';
import enMessages from '@/messages/en.json';

// ── Cache stable translator functions per namespace ────────────────────

const _translatorCache = new Map<
  string,
  (key: string, params?: Record<string, string>) => string
>();

function createTranslator(ns: string) {
  const parts = ns.split('.');
  let scope: Record<string, unknown> = enMessages as Record<string, unknown>;
  for (const part of parts) {
    const nextScope = (scope as Record<string, unknown>)[part];
    if (typeof nextScope === 'object' && nextScope !== null) {
      scope = nextScope as Record<string, unknown>;
    } else {
      break;
    }
  }
  return (key: string, params?: Record<string, string>): string => {
    const raw = scope[key];
    if (typeof raw !== 'string') return key;
    if (params) {
      let result = raw;
      for (const [pk, pv] of Object.entries(params)) {
        result = result.replace(`{${pk}}`, pv);
      }
      return result;
    }
    return raw;
  };
}

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => {
    const namespace = ns ?? '';
    if (!_translatorCache.has(namespace)) {
      _translatorCache.set(namespace, createTranslator(namespace));
    }
    return _translatorCache.get(namespace)!;
  },
  useLocale: () => 'en',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// ── Hoisted stable references for useCallback dependencies ─────────────
// These MUST be created via vi.hoisted so they are available when vi.mock
// factory functions run (vi.mock is hoisted to the top of the file).

const { _mockShowSnackbar, _mockRouter } = vi.hoisted(() => ({
  _mockShowSnackbar: vi.fn(),
  _mockRouter: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => _mockRouter,
  useParams: () => ({ publicLinkId: 'test-link-123' }),
}));

vi.mock('@/components/providers/SnackbarProvider', () => ({
  SnackbarProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useSnackbar: () => ({ showSnackbar: _mockShowSnackbar }),
}));

vi.mock('@/hooks/useOtpAction', () => ({
  useOtpAction: (options: {
    createChallenge: (
      action: string,
      resourceType: string,
      resourceId: string,
    ) => Promise<unknown>;
    resendOtp: (challengeId: string) => Promise<unknown>;
    verifyOtp: (challengeId: string, code: string) => Promise<unknown>;
  }) => ({
    currentChallenge: null,
    isSubmitting: false,
    resendCooldown: 0,
    canResendOtp: true,
    startAction: (action: string, resourceType: string, resourceId: string) =>
      options.createChallenge(action, resourceType, resourceId),
    handleResend: () => Promise.resolve(),
    handleVerify: () => Promise.resolve({}),
    closeFlow: vi.fn(),
  }),
}));

// ── API mocks ──────────────────────────────────────────────────────────

const mockBootstrapPublicSessionApi = vi.fn();
const mockGetPublicDocumentMeApi = vi.fn();
const mockGetPublicDocumentLocksApi = vi.fn();
const mockCreatePublicOtpChallengeApi = vi.fn();
const mockResendPublicOtpApi = vi.fn();
const mockVerifyPublicOtpApi = vi.fn();

vi.mock('@/lib/api/endpoints/public-session', () => ({
  bootstrapPublicSessionApi: (publicLinkId: string) =>
    mockBootstrapPublicSessionApi(publicLinkId),
  logoutPublicSessionApi: vi.fn(),
}));

vi.mock('@/lib/api/endpoints/public-documents', () => ({
  getPublicDocumentMeApi: () => mockGetPublicDocumentMeApi(),
}));

vi.mock('@/lib/api/endpoints/document-locks', () => ({
  getPublicDocumentLocksApi: () => mockGetPublicDocumentLocksApi(),
  resolvePublicDocumentLockApi: vi.fn(),
}));

vi.mock('@/lib/api/endpoints/public-otp', () => ({
  createPublicOtpChallengeApi: (
    action: string,
    resourceType: string,
    resourceId: string,
  ) => mockCreatePublicOtpChallengeApi(action, resourceType, resourceId),
  resendPublicOtpApi: (challengeId: string) =>
    mockResendPublicOtpApi(challengeId),
  verifyPublicOtpApi: (challengeId: string, code: string) =>
    mockVerifyPublicOtpApi(challengeId, code),
}));

vi.mock('@/app/locale', () => ({
  useLocaleContext: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

// Mock SignerConsentModal — immediately calls onConfirm when rendered
vi.mock('@/components/signing/SignerConsentModal', () => ({
  SignerConsentModal: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    documentName: string;
    action: string | null;
  }) => {
    // Auto-confirm when the modal opens to simulate the consent flow
    if (open) {
      // Defer the onConfirm call to next tick so React state settles first
      setTimeout(() => onConfirm(), 0);
    }
    return open ? (
      <div data-testid="signer-consent-modal">Consent Modal</div>
    ) : null;
  },
}));

import PublicDocumentPage from '../page';

// ── Test data ──────────────────────────────────────────────────────────

const MOCK_PUBLIC_DOCUMENT: PublicDocumentMeResponse = {
  id: 'doc-001',
  document_name: 'Test Document',
  description: 'A test document',
  file_size_bytes: 102400,
  original_filename: 'test.pdf',
  mime_type: 'application/pdf',
  status: 'SIGNED',
  expires_at: null,
  sender_name: 'Alice Sender',
  sender_email: 'alice@example.com',
  my_recipient: {
    id: 'rec-001',
    recipient_email: 'recipient@example.com',
    recipient_name: 'Recipient Name',
    signing_status: 'SIGNED',
    signed_at: '2026-06-21T08:00:00.000Z',
    rejected_at: null,
    revoked_at: null,
  },
};

function renderPage() {
  return render(
    <ThemeProvider theme={createAppTheme('light')}>
      <PublicDocumentPage />
    </ThemeProvider>,
  );
}

/**
 * Setup common mocks and wait for the public document page to finish loading.
 * Returns after the Revoke button is visible in the DOM.
 */
async function loadPage() {
  mockBootstrapPublicSessionApi.mockResolvedValue({
    status: 'ANON_ALLOWED',
    documentId: 'doc-001',
  });
  mockGetPublicDocumentMeApi.mockResolvedValue(MOCK_PUBLIC_DOCUMENT);
  mockGetPublicDocumentLocksApi.mockResolvedValue([]);

  renderPage();
  await screen.findByRole('button', { name: /revoke/i }, { timeout: 3000 });
}

// ── Lifecycle ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Consent modal tests (3.4) ──────────────────────────────────────

describe('PublicDocumentPage consent modal', () => {
  it('3.4a renders consent modal on revoke button click', async () => {
    await loadPage();

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));

    // Consent modal appears directly (no intermediate confirmation dialog)
    await waitFor(() => {
      expect(screen.getByTestId('signer-consent-modal')).toBeInTheDocument();
    });
  });

  it('3.4b consent modal auto-confirms and proceeds to OTP challenge', async () => {
    mockCreatePublicOtpChallengeApi.mockResolvedValue({
      challengeId: 'ch-001',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      resendAvailableAt: null,
      maskedDestination: '***@***.com',
      remainingAttempts: 3,
      remainingResends: 3,
    });

    await loadPage();

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));

    // Consent modal appears and auto-confirms (mocked)
    await waitFor(() => {
      expect(screen.getByTestId('signer-consent-modal')).toBeInTheDocument();
    });

    // OTP challenge should have been created by the auto-confirm flow
    await waitFor(() => {
      expect(mockCreatePublicOtpChallengeApi).toHaveBeenCalledWith(
        'REVOKE',
        'DOCUMENT',
        'doc-001',
      );
    });
  });
});
