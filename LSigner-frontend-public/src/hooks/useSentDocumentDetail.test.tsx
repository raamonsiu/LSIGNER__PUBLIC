import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useSentDocumentDetail } from './useSentDocumentDetail';
import type { SentDocumentDetailResponse } from '@/lib/api/endpoints/types';

const mockGetSentDocumentByIdApi = vi.fn();
const mockFetchDocumentDownloadBlobUrl = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock('@/lib/api/endpoints/documents', () => ({
  getSentDocumentByIdApi: (id: string) => mockGetSentDocumentByIdApi(id),
  fetchDocumentDownloadBlobUrl: (id: string) =>
    mockFetchDocumentDownloadBlobUrl(id),
  deleteSentDocumentSharedAccessApi: vi.fn(),
  sendSentDocumentReminderApi: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
}));

const MOCK_DETAIL: SentDocumentDetailResponse = {
  id: 'doc-1',
  document_name: 'Test Document',
  description: null,
  file_size_bytes: 204800,
  original_filename: 'test.pdf',
  mime_type: 'application/pdf',
  version: 1,
  status: 'WAITING',
  sent_at: '2026-06-20T10:00:00.000Z',
  signed_at: null,
  final_recipient_name: 'Alice',
  created_at: '2026-06-19T10:00:00.000Z',
  updated_at: '2026-06-20T10:00:00.000Z',
  recipients: [
    {
      id: 'rec-1',
      recipient_email: 'alice@example.com',
      recipient_name: 'Alice',
      sent_at: '2026-06-20T10:00:00.000Z',
      signing_status: 'PENDING',
      first_accessed_at: null,
      last_accessed_at: null,
      signed_at: null,
    },
  ],
};

const MOCK_BLOB = new Blob(['pdf content'], { type: 'application/pdf' });

const testTheme = createTheme({
  palette: {
    chip: {
      errorText: '#d32f2f',
      errorBg: '#fdecea',
      waitText: '#ed6c02',
      waitBg: '#fff4e5',
      successText: '#2e7d32',
      successBg: '#e8f5e9',
    },
    nav: {
      iconColor: '#1976d2',
      iconBg: '#e3f2fd',
    },
  } as ReturnType<typeof createTheme>['palette'],
});

function renderHookWithTheme<Result>(hook: () => Result) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider theme={testTheme}>{children}</ThemeProvider>
    ),
  });
}

describe('useSentDocumentDetail', () => {
  const showSnackbar = vi.fn();
  const t = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      'messages.popup_blocked': 'Popup blocked',
      'messages.session_expired': 'Session expired',
      'messages.open_document_error': 'Could not open document',
    };
    return translations[key] ?? key;
  });
  const onAfterDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(
      () => 'blob:test-url',
    ) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    window.open = vi.fn(() => ({ opener: null }) as Window);
  });

  async function setupHookWithDetail() {
    mockGetSentDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHookWithTheme(() =>
      useSentDocumentDetail({ showSnackbar, t, onAfterDelete }),
    );

    await act(async () => {
      await result.current.showDocument('doc-1', 'alice@example.com');
    });

    return result;
  }

  describe('handleOpenDocument', () => {
    it('fetches blob, creates blob URL, and opens window on success', async () => {
      mockFetchDocumentDownloadBlobUrl.mockResolvedValue(MOCK_BLOB);

      const result = await setupHookWithDetail();

      await act(async () => {
        await result.current.handleOpenDocument();
      });

      expect(mockFetchDocumentDownloadBlobUrl).toHaveBeenCalledWith('doc-1');
      expect(URL.createObjectURL).toHaveBeenCalledWith(MOCK_BLOB);
      expect(window.open).toHaveBeenCalledWith('blob:test-url', '_blank');
      expect(showSnackbar).not.toHaveBeenCalled();
    });

    it('shows popup_blocked snackbar when window.open returns null', async () => {
      mockFetchDocumentDownloadBlobUrl.mockResolvedValue(MOCK_BLOB);
      window.open = vi.fn(() => null);

      const result = await setupHookWithDetail();

      await act(async () => {
        await result.current.handleOpenDocument();
      });

      expect(showSnackbar).toHaveBeenCalledWith('Popup blocked', 'warning');
    });

    it('redirects to login on DOWNLOAD_FAILED_401', async () => {
      mockFetchDocumentDownloadBlobUrl.mockRejectedValue(
        new Error('DOWNLOAD_FAILED_401'),
      );

      const result = await setupHookWithDetail();

      await act(async () => {
        await result.current.handleOpenDocument();
      });

      expect(showSnackbar).toHaveBeenCalledWith('Session expired', 'warning');
      expect(mockRouterReplace).toHaveBeenCalledWith('/login?reason=expired');
    });

    it('shows open_document_error snackbar on network failure', async () => {
      mockFetchDocumentDownloadBlobUrl.mockRejectedValue(
        new Error('DOWNLOAD_FAILED'),
      );

      const result = await setupHookWithDetail();

      await act(async () => {
        await result.current.handleOpenDocument();
      });

      expect(showSnackbar).toHaveBeenCalledWith(
        'Could not open document',
        'error',
      );
    });

    it('does nothing when no document is selected', async () => {
      const { result } = renderHookWithTheme(() =>
        useSentDocumentDetail({ showSnackbar, t }),
      );

      await act(async () => {
        await result.current.handleOpenDocument();
      });

      expect(mockFetchDocumentDownloadBlobUrl).not.toHaveBeenCalled();
    });

    it('revokes blob URL after 60 seconds', async () => {
      vi.useFakeTimers();
      mockFetchDocumentDownloadBlobUrl.mockResolvedValue(MOCK_BLOB);

      const result = await setupHookWithDetail();

      await act(async () => {
        await result.current.handleOpenDocument();
      });

      expect(URL.revokeObjectURL).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
      vi.useRealTimers();
    });
  });
});
