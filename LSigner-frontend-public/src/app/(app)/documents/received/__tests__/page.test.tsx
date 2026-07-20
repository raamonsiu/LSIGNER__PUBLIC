import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { SnackbarProvider } from '@/components/providers/SnackbarProvider';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import { createAppTheme } from '@/app/theme/muiTheme';
import { SESSION_KEY } from '@/lib/auth/AuthContext';
import type {
  ReceivedDocumentsListResponse,
  ReceivedDocumentDetailResponse,
} from '@/lib/api/endpoints/types';

const mockGetReceivedDocumentsApi = vi.fn();
const mockGetReceivedDocumentByIdApi = vi.fn();
const mockGetReceivedDocumentViewUrlApi = vi.fn();
const mockFetchDocumentDownloadBlobUrl = vi.fn();
const mockGetSharedDocumentLocksApi = vi.fn();
const mockResolveSharedDocumentLockApi = vi.fn();
const mockCreateOtpChallengeApi = vi.fn();
const mockResendOtpApi = vi.fn();
const mockVerifyOtpApi = vi.fn();

const originalFetch = global.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

vi.mock('@/lib/api/endpoints/documents', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/api/endpoints/documents')>();
  return {
    ...actual,
    getReceivedDocumentsApi: () => mockGetReceivedDocumentsApi(),
    getReceivedDocumentByIdApi: (id: string) =>
      mockGetReceivedDocumentByIdApi(id),
    getReceivedDocumentViewUrlApi: (id: string) =>
      mockGetReceivedDocumentViewUrlApi(id),
    fetchDocumentDownloadBlobUrl: (id: string) =>
      mockFetchDocumentDownloadBlobUrl(id),
  };
});

vi.mock('@/lib/api/endpoints/document-locks', () => ({
  getPrivateDocumentLocksApi: (documentId: string) =>
    mockGetSharedDocumentLocksApi(documentId),
  resolvePrivateDocumentLockApi: (
    documentId: string,
    lockId: string,
    password: string,
  ) => mockResolveSharedDocumentLockApi(documentId, lockId, password),
}));

vi.mock('@/lib/api/endpoints/otp', () => ({
  createOtpChallengeApi: (
    action: string,
    resourceType: string,
    resourceId: string,
  ) => mockCreateOtpChallengeApi(action, resourceType, resourceId),
  resendOtpApi: (challengeId: string) => mockResendOtpApi(challengeId),
  verifyOtpApi: (challengeId: string, code: string) =>
    mockVerifyOtpApi(challengeId, code),
}));

vi.mock('@/app/locale', () => ({
  useLocaleContext: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import ReceivedDocumentsPage from '../page';

function renderPage() {
  return render(
    withIntlProvider(
      <ThemeProvider theme={createAppTheme('light')}>
        <SnackbarProvider>
          <ReceivedDocumentsPage />
        </SnackbarProvider>
      </ThemeProvider>,
    ),
  );
}

const MOCK_LIST_RESPONSE: ReceivedDocumentsListResponse = {
  stats: {
    total_received: 5,
    pending_my_signature: 2,
    signed_by_me: 2,
    rejected_or_revoked: 1,
  },
  items: [
    {
      id: 'recv-001',
      document_name: 'NDA ABC Corp',
      file_size_bytes: 204800,
      received_at: '2026-06-21T08:00:00.000Z',
      signed_at: null,
      expires_at: '2026-07-01T23:59:59.000Z',
      sender_name: 'Alice Example',
      sender_email: 'alice@example.com',
      status: 'PENDING',
    },
    {
      id: 'recv-002',
      document_name: 'Service Contract',
      file_size_bytes: 102400,
      received_at: '2026-06-18T10:00:00.000Z',
      signed_at: '2026-06-20T12:00:00.000Z',
      expires_at: null,
      sender_name: null,
      sender_email: 'bob@corp.com',
      status: 'SIGNED',
    },
    {
      id: 'recv-003',
      document_name: 'Proposal Rejected',
      file_size_bytes: 50000,
      received_at: '2026-06-10T09:00:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'Charlie',
      sender_email: 'charlie@test.com',
      status: 'REJECTED',
    },
  ],
};

const MOCK_DETAIL_RESPONSE: ReceivedDocumentDetailResponse = {
  id: 'recv-001',
  document_name: 'NDA ABC Corp',
  description: 'Confidentiality agreement',
  file_size_bytes: 204800,
  original_filename: 'nda_abc_corp.pdf',
  mime_type: 'application/pdf',
  version: 1,
  status: 'PENDING',
  received_at: '2026-06-21T08:00:00.000Z',
  signed_at: null,
  expires_at: '2026-07-01T23:59:59.000Z',
  created_at: '2026-06-20T08:00:00.000Z',
  updated_at: '2026-06-21T08:00:00.000Z',
  sender: {
    id: 'user-001',
    name: 'Alice Example',
    email: 'alice@example.com',
    deleted: false,
  },
  my_recipient: {
    id: 'rec-001',
    recipient_email: 'me@example.com',
    recipient_name: 'My Name',
    signing_status: 'PENDING',
    first_accessed_at: null,
    last_accessed_at: null,
    signed_at: null,
    rejected_at: null,
    revoked_at: null,
  },
};

const originalOpen = window.open;

function setValidAuthSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: 'valid.jwt',
      refreshToken: 'valid.rt',
      expiresAt: Date.now() + 60_000,
      user: {
        patient_id: 'usr-1',
        name: 'Test',
        last_name: 'User',
        country: 'ES',
        national_id: null,
        passport: null,
        email: 'test@example.com',
        phone_number: '+34600000000',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.open = vi.fn(() => ({}) as Window);
  global.fetch = originalFetch;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  localStorage.removeItem(SESSION_KEY);
});

afterEach(() => {
  window.open = originalOpen;
  global.fetch = originalFetch;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  localStorage.removeItem(SESSION_KEY);
});

describe('ReceivedDocumentsPage', () => {
  it('shows loading skeletons while fetching', () => {
    mockGetReceivedDocumentsApi.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error message when API call fails', async () => {
    mockGetReceivedDocumentsApi.mockRejectedValue(new Error('Network error'));

    renderPage();

    expect(
      await screen.findByText(/received documents could not be loaded/i),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows empty message when no documents', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue({
      stats: {
        total_received: 0,
        pending_my_signature: 0,
        signed_by_me: 0,
        rejected_or_revoked: 0,
      },
      items: [],
    });

    renderPage();

    expect(
      await screen.findByText(/you have not received any documents yet/i),
    ).toBeInTheDocument();
  });

  it('renders metric cards and document list', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);

    renderPage();

    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getByText('NDA ABC Corp')).toBeInTheDocument();
    expect(screen.getByText('Service Contract')).toBeInTheDocument();
    expect(screen.getByText('Proposal Rejected')).toBeInTheDocument();
  });

  it('opens modal with detail on document click', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);

    expect(await screen.findByText(/document details/i)).toBeInTheDocument();

    expect(screen.getAllByText(/Alice Example/i).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText(/nda_abc_corp\.pdf/i)).toBeInTheDocument();
  });

  it('opens document URL on view document click', async () => {
    setValidAuthSession();
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetReceivedDocumentViewUrlApi.mockResolvedValue({
      url: 'https://cdn.example.com/documents/recv-001.pdf',
    });
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(
      new Blob(['mock'], { type: 'application/pdf' }),
    );

    URL.createObjectURL = vi.fn(
      () => 'blob:mock-document',
    ) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);

    await screen.findByText(/document details/i);

    const viewButtons = screen.getAllByRole('button', {
      name: /view document/i,
    });
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(mockFetchDocumentDownloadBlobUrl).toHaveBeenCalledWith('recv-001');
    });

    expect(window.open).toHaveBeenCalledWith('blob:mock-document', '_blank');
  });

  it('loads data URL preview for sign flow via FileReader', async () => {
    setValidAuthSession();
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetSharedDocumentLocksApi.mockResolvedValue([]);
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(
      new Blob(['mock'], { type: 'application/pdf' }),
    );

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);

    await screen.findByText(/document details/i);

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    await waitFor(() => {
      const objectEl = screen.getByTitle(/document preview/i);
      expect(objectEl).toHaveAttribute(
        'data',
        expect.stringMatching(/^data:application\/pdf;base64,/),
      );
    });

    expect(mockGetReceivedDocumentViewUrlApi).not.toHaveBeenCalled();
  });

  it('shows snackbar on view document error', async () => {
    setValidAuthSession();
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetReceivedDocumentViewUrlApi.mockResolvedValue({
      url: 'https://cdn.example.com/documents/recv-001.pdf',
    });
    mockFetchDocumentDownloadBlobUrl.mockRejectedValue(
      new Error('Failed to fetch URL'),
    );

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);

    await screen.findByText(/document details/i);

    const viewButtons = screen.getAllByRole('button', {
      name: /view document/i,
    });
    fireEvent.click(viewButtons[0]);

    expect(
      await screen.findByText(/could not be opened in a new tab/i),
    ).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);

    await screen.findByText(/document details/i);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByText(/document details/i)).not.toBeInTheDocument();
    });
  });

  it('shows blocked chip and red styling when document has unresolved locks', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentViewUrlApi.mockResolvedValue({
      url: 'http://localhost:3001/public/link-123',
    });
    mockGetSharedDocumentLocksApi.mockResolvedValue([
      {
        id: 'lock-1',
        lock_type: 'PASSWORD',
        is_resolved: false,
        resolved_at: null,
      },
    ]);

    renderPage();

    await screen.findByText('NDA ABC Corp');

    await waitFor(() => {
      expect(screen.getByText(/BLOCKED/i)).toBeInTheDocument();
    });
  });

  it('opens unlock modal when clicking a blocked document', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetReceivedDocumentViewUrlApi.mockResolvedValue({
      url: 'http://localhost:3001/public/link-123',
    });
    mockGetSharedDocumentLocksApi.mockResolvedValue([
      {
        id: 'lock-1',
        lock_type: 'PASSWORD',
        is_resolved: false,
        resolved_at: null,
      },
    ]);

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');

    await waitFor(() => {
      expect(screen.getByText(/BLOCKED/i)).toBeInTheDocument();
    });

    fireEvent.click(docItem.closest('[role="button"]')!);

    expect(await screen.findByText(/blocked document/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter document password/i),
    ).toBeInTheDocument();
  });

  it('unlock with correct password closes unlock modal and opens detail modal', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetReceivedDocumentViewUrlApi.mockResolvedValue({
      url: 'http://localhost:3001/public/link-123',
    });
    mockGetSharedDocumentLocksApi.mockResolvedValue([
      {
        id: 'lock-1',
        lock_type: 'PASSWORD',
        is_resolved: false,
        resolved_at: null,
      },
    ]);
    mockResolveSharedDocumentLockApi.mockResolvedValue(undefined);

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');

    await waitFor(() => {
      expect(screen.getByText(/BLOCKED/i)).toBeInTheDocument();
    });

    fireEvent.click(docItem.closest('[role="button"]')!);

    await screen.findByText(/blocked document/i);

    const passwordInput = screen.getByPlaceholderText(
      /enter document password/i,
    );
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /^unlock$/i }));

    await screen.findByText(/document details/i);

    expect(screen.getByText(/nda_abc_corp\.pdf/i)).toBeInTheDocument();
  });

  it('shows error on wrong password and keeps unlock modal open', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetReceivedDocumentViewUrlApi.mockResolvedValue({
      url: 'http://localhost:3001/public/link-123',
    });
    mockGetSharedDocumentLocksApi.mockResolvedValue([
      {
        id: 'lock-1',
        lock_type: 'PASSWORD',
        is_resolved: false,
        resolved_at: null,
      },
    ]);

    mockResolveSharedDocumentLockApi.mockRejectedValue(
      new Error('Network failure'),
    );

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');

    await waitFor(() => {
      expect(screen.getByText(/BLOCKED/i)).toBeInTheDocument();
    });

    fireEvent.click(docItem.closest('[role="button"]')!);

    await screen.findByText(/blocked document/i);

    const passwordInput = screen.getByPlaceholderText(
      /enter document password/i,
    );
    fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });

    fireEvent.click(screen.getByRole('button', { name: /^unlock$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/could not unlock the document/i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/document details/i)).not.toBeInTheDocument();
  });

  // ── Consent modal tests (2.3, 2.4, 2.5) ────────────────────────────

  it('2.3 renders consent modal on reject button click in preview', async () => {
    setValidAuthSession();
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetSharedDocumentLocksApi.mockResolvedValue([]);
    mockCreateOtpChallengeApi.mockReturnValue(
      new Promise(() => {}), // never resolves during test — we only assert dialog
    );
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(
      new Blob(['mock'], { type: 'application/pdf' }),
    );

    URL.createObjectURL = vi.fn(
      () => 'blob:preview-document',
    ) as typeof URL.createObjectURL;

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);
    await screen.findByText(/document details/i);

    // Click Reject to enter preview flow
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    // Wait for preview dialog
    await waitFor(() => {
      expect(screen.getByTitle(/document preview/i)).toBeInTheDocument();
    });

    // Click the action button in the preview dialog (FilledButton with reject text)
    const actionButtons = screen.getAllByRole('button', { name: /reject/i });
    // The action button is the FilledButton inside the preview dialog
    const actionButton = actionButtons.find(
      (btn) =>
        btn.closest('[role="dialog"]') &&
        btn.textContent?.toLowerCase().includes('reject'),
    );
    expect(actionButton).toBeTruthy();
    fireEvent.click(actionButton!);

    // Consent modal should appear directly (no intermediate confirmation dialog)
    await waitFor(() => {
      expect(
        screen.getByText(/you are about to reject this document/i),
      ).toBeInTheDocument();
    });
  });

  it('2.4 Cancel on consent modal dismisses without creating OTP', async () => {
    setValidAuthSession();
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetSharedDocumentLocksApi.mockResolvedValue([]);
    mockCreateOtpChallengeApi.mockResolvedValue({
      challengeId: 'ch-001',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      resendAvailableAt: null,
      maskedDestination: '***@***.com',
      remainingAttempts: 3,
      remainingResends: 3,
    });
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(
      new Blob(['mock'], { type: 'application/pdf' }),
    );

    URL.createObjectURL = vi.fn(
      () => 'blob:preview-document',
    ) as typeof URL.createObjectURL;

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);
    await screen.findByText(/document details/i);

    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      expect(screen.getByTitle(/document preview/i)).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole('button', { name: /reject/i });
    const actionButton = actionButtons.find(
      (btn) =>
        btn.closest('[role="dialog"]') &&
        btn.textContent?.toLowerCase().includes('reject'),
    );
    fireEvent.click(actionButton!);

    // Consent modal appears directly
    await waitFor(() => {
      expect(
        screen.getByText(/you are about to reject this document/i),
      ).toBeInTheDocument();
    });

    // Click Cancel on consent modal
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    // Consent modal should close — back to preview
    await waitFor(() => {
      expect(
        screen.queryByText(/you are about to reject this document/i),
      ).not.toBeInTheDocument();
    });

    // Assert OTP challenge was NOT created
    expect(mockCreateOtpChallengeApi).not.toHaveBeenCalled();
  });

  it('2.5 proceed from preview to consent then OTP', async () => {
    setValidAuthSession();
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL_RESPONSE);
    mockGetSharedDocumentLocksApi.mockResolvedValue([]);
    mockCreateOtpChallengeApi.mockResolvedValue({
      challengeId: 'ch-001',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      resendAvailableAt: null,
      maskedDestination: '***@***.com',
      remainingAttempts: 3,
      remainingResends: 3,
    });
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(
      new Blob(['mock'], { type: 'application/pdf' }),
    );

    URL.createObjectURL = vi.fn(
      () => 'blob:preview-document',
    ) as typeof URL.createObjectURL;

    renderPage();

    const docItem = await screen.findByText('NDA ABC Corp');
    fireEvent.click(docItem.closest('[role="button"]')!);
    await screen.findByText(/document details/i);

    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      expect(screen.getByTitle(/document preview/i)).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole('button', { name: /reject/i });
    const actionButton = actionButtons.find(
      (btn) =>
        btn.closest('[role="dialog"]') &&
        btn.textContent?.toLowerCase().includes('reject'),
    );
    fireEvent.click(actionButton!);

    // Consent modal should appear directly
    await waitFor(() => {
      expect(
        screen.getByText(/you are about to reject this document/i),
      ).toBeInTheDocument();
    });

    // Check the consent checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Click "Confirm and continue"
    fireEvent.click(
      screen.getByRole('button', { name: /confirm and continue/i }),
    );

    // Assert OTP challenge was created
    await waitFor(() => {
      expect(mockCreateOtpChallengeApi).toHaveBeenCalledWith(
        'REJECT',
        'DOCUMENT',
        'recv-001',
      );
    });
  });
});
