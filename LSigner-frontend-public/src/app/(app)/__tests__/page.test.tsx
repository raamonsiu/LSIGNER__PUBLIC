import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@/app/theme/muiTheme';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import DashboardPage from '../page';
import type {
  SentRecipientsListResponse,
  ReceivedDocumentsListResponse,
} from '@/lib/api/endpoints/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => '/',
}));

// Mock useDashboardData — control all return values via dynamic mock
let mockDashboardData: {
  sentData: SentRecipientsListResponse | null;
  receivedData: ReceivedDocumentsListResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} = {
  sentData: null,
  receivedData: null,
  loading: true,
  error: null,
  refetch: vi.fn(),
};

vi.mock('../hooks/useDashboardData', () => ({
  useDashboardData: () => mockDashboardData,
  normalizeRecentItems: () => [],
}));

// Mock useWizard
const mockOpenWizard = vi.fn();
vi.mock('@/components/providers/SendDocumentWizardProvider', () => ({
  useWizard: () => ({
    closeCount: 0,
    openWizard: mockOpenWizard,
    closeWizard: vi.fn(),
    finishWizard: vi.fn(),
  }),
}));

// Mock useReceivedDocumentDetail
const mockShowDocument = vi.fn();
const mockCloseDetail = vi.fn();
const mockOpenDocument = vi.fn();
vi.mock('@/hooks/useReceivedDocumentDetail', () => ({
  useReceivedDocumentDetail: () => ({
    selectedDocument: null,
    isDetailModalOpen: false,
    isModalDetailLoading: false,
    isOpenDocumentLoading: false,
    actionFlowDocId: null,
    pendingAction: null,
    showDocument: mockShowDocument,
    closeDetail: mockCloseDetail,
    openDocument: mockOpenDocument,
    startActionFlow: vi.fn(),
    closeActionFlow: vi.fn(),
    setSelectedDocument: vi.fn(),
    setIsDetailModalOpen: vi.fn(),
    setActionFlowDocId: vi.fn(),
    setPendingAction: vi.fn(),
  }),
  fetchDownloadDataUrl: vi.fn(),
}));

// Mock useSentDocumentDetail
vi.mock('@/hooks/useSentDocumentDetail', () => ({
  useSentDocumentDetail: () => ({
    selectedDocumentDetail: null,
    isDetailModalOpen: false,
    isModalDetailLoading: false,
    isReminderLoading: false,
    isDeleteLoading: false,
    isOpenDocumentLoading: false,
    showDeleteConfirmation: false,
    deleteConfirmationText: '',
    selectedRecipientEmail: null,
    selectedRecipient: null,
    canSendReminder: false,
    canDeleteSharedAccess: false,
    deleteConfirmationKeyword: 'remove',
    isDeleteKeywordMatched: false,
    showDocument: vi.fn(),
    closeDetail: vi.fn(),
    handleOpenDocument: vi.fn(),
    handleSendReminder: vi.fn(),
    handleDeleteSharedAccess: vi.fn(),
    setDeleteConfirmationText: vi.fn(),
    setShowDeleteConfirmation: vi.fn(),
  }),
}));

// Mock useOtpAction
vi.mock('@/hooks/useOtpAction', () => ({
  useOtpAction: () => ({
    currentChallenge: null,
    isSubmitting: false,
    resendCooldown: 0,
    canResendOtp: false,
    startAction: vi.fn(),
    handleResend: vi.fn(),
    handleVerify: vi.fn(),
    closeFlow: vi.fn(),
  }),
}));

// Mock OTP API endpoints
vi.mock('@/lib/api/endpoints/otp', () => ({
  createOtpChallengeApi: vi.fn(),
  resendOtpApi: vi.fn(),
  verifyOtpApi: vi.fn(),
}));

// Mock ApiError
vi.mock('@/lib/api/core/errors', () => ({
  ApiError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

// Mock DocumentPreviewDialog and OtpVerificationDialog (heavy components)
vi.mock('../documents/received/components/DocumentPreviewDialog', () => ({
  default: () => null,
}));

vi.mock('../documents/received/components/OtpVerificationDialog', () => ({
  default: () => null,
}));

// Mock useSnackbar
const mockShowSnackbar = vi.fn();
vi.mock('@/components/providers/SnackbarProvider', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

vi.mock('@/app/locale', () => ({
  useLocaleContext: () => ({ locale: 'en' }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_SENT_DATA: SentRecipientsListResponse = {
  items: [
    {
      recipient_email: 'maria@example.com',
      recipient_name: 'María López',
      signing_status: 'PENDING',
      signed_at: null,
      sent_at: '2026-06-28T10:00:00.000Z',
      document_id: 'doc-sent-1',
      document_name: 'Contrato de Arrendamiento',
      first_accessed_at: null,
      last_accessed_at: null,
    },
    {
      recipient_email: 'carlos@example.com',
      recipient_name: 'Carlos',
      signing_status: 'PENDING',
      signed_at: null,
      sent_at: '2026-06-27T10:00:00.000Z',
      document_id: 'doc-sent-2',
      document_name: 'Factura',
      first_accessed_at: null,
      last_accessed_at: null,
    },
    {
      recipient_email: 'laura@example.com',
      recipient_name: 'Laura',
      signing_status: 'PENDING',
      signed_at: null,
      sent_at: '2026-06-26T10:00:00.000Z',
      document_id: 'doc-sent-3',
      document_name: 'Propuesta',
      first_accessed_at: null,
      last_accessed_at: null,
    },
  ],
};

const MOCK_RECEIVED_DATA: ReceivedDocumentsListResponse = {
  items: [
    {
      id: 'doc-rec-1',
      document_name: 'NDA — ABC Corp',
      file_size_bytes: 204800,
      received_at: '2026-06-29T14:00:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'Ana Rodríguez',
      sender_email: 'ana@example.com',
      status: 'PENDING',
    },
    {
      id: 'doc-rec-2',
      document_name: 'Contrato',
      file_size_bytes: 102400,
      received_at: '2026-06-28T14:00:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'Pedro',
      sender_email: 'pedro@example.com',
      status: 'PENDING',
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    withIntlProvider(
      <ThemeProvider theme={createAppTheme('light')}>
        <DashboardPage />
      </ThemeProvider>,
    ),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardData = {
      sentData: null,
      receivedData: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    };
  });

  describe('loading state', () => {
    it('renders skeleton placeholders while loading', () => {
      mockDashboardData.loading = true;

      renderPage();

      // MUI Skeleton renders as span elements with class MuiSkeleton-root
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error state', () => {
    it('renders error alert with retry button when data fetch fails', () => {
      mockDashboardData.loading = false;
      mockDashboardData.error = 'Network error';
      mockDashboardData.refetch = vi.fn();

      renderPage();

      // Error message should be visible (two Alerts rendered)
      const errorMessages = screen.getAllByText(
        'Dashboard data could not be loaded.',
      );
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);

      // Retry buttons should be present
      const retryButtons = screen.getAllByRole('button', { name: 'Retry' });
      expect(retryButtons.length).toBeGreaterThanOrEqual(1);

      // Clicking retry calls refetch
      fireEvent.click(retryButtons[0]);
      expect(mockDashboardData.refetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT render metric cards when error is present', () => {
      mockDashboardData.loading = false;
      mockDashboardData.error = 'Error';

      renderPage();

      // The metric card labels should not appear
      expect(
        screen.queryByText('Pending your signature'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Waiting for others')).not.toBeInTheDocument();
    });
  });

  describe('success state — stats section', () => {
    it('renders "Pending your signature" metric with value from receivedStats', () => {
      mockDashboardData.loading = false;
      mockDashboardData.sentData = MOCK_SENT_DATA;
      mockDashboardData.receivedData = MOCK_RECEIVED_DATA;

      renderPage();

      // The "Pending your signature" value should be 2 (pending_my_signature)
      expect(screen.getByText('Pending your signature')).toBeInTheDocument();
      // The numeric value "02" (padded)
      expect(screen.getByText('02')).toBeInTheDocument();
    });

    it('renders "Waiting for others" metric with value from sentStats.pending', () => {
      mockDashboardData.loading = false;
      mockDashboardData.sentData = MOCK_SENT_DATA;
      mockDashboardData.receivedData = MOCK_RECEIVED_DATA;

      renderPage();

      expect(screen.getByText('Waiting for others')).toBeInTheDocument();
      // sentStats.pending = 3, padded to "03"
      expect(screen.getByText('03')).toBeInTheDocument();
    });

    it('shows zero when APIs return but stats are empty', () => {
      mockDashboardData.loading = false;
      mockDashboardData.sentData = {
        stats: { total: 0, pending: 0, signed: 0, rejected: 0, revoked: 0 },
        items: [],
      };
      mockDashboardData.receivedData = {
        stats: {
          total_received: 0,
          pending_my_signature: 0,
          signed_by_me: 0,
          rejected_or_revoked: 0,
        },
        items: [],
      };

      renderPage();

      // Both values should show "00"
      const zeros = screen.getAllByText('00');
      expect(zeros.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('empty recent documents', () => {
    it('renders empty state message when both lists are empty', () => {
      mockDashboardData.loading = false;
      mockDashboardData.sentData = {
        stats: { total: 0, pending: 0, signed: 0, rejected: 0, revoked: 0 },
        items: [],
      };
      mockDashboardData.receivedData = {
        stats: {
          total_received: 0,
          pending_my_signature: 0,
          signed_by_me: 0,
          rejected_or_revoked: 0,
        },
        items: [],
      };

      renderPage();

      expect(screen.getByText('No recent documents')).toBeInTheDocument();
    });
  });
});
