import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import {
  useReceivedDocumentDetail,
  fetchDownloadDataUrl,
} from './useReceivedDocumentDetail';
import { SESSION_KEY } from '@/lib/auth/AuthContext';
import type { ReceivedDocumentDetailResponse } from '@/lib/api/endpoints/types';

const mockGetReceivedDocumentByIdApi = vi.fn();
const mockGetPrivateDocumentLocksApi = vi.fn();
const mockFetchDocumentDownloadBlobUrl = vi.fn();

vi.mock('@/lib/api/endpoints/documents', () => ({
  getReceivedDocumentByIdApi: (id: string) =>
    mockGetReceivedDocumentByIdApi(id),
  fetchDocumentDownloadBlobUrl: (id: string) =>
    mockFetchDocumentDownloadBlobUrl(id),
}));

vi.mock('@/lib/api/endpoints/document-locks', () => ({
  getPrivateDocumentLocksApi: (documentId: string) =>
    mockGetPrivateDocumentLocksApi(documentId),
}));

const MOCK_DETAIL: ReceivedDocumentDetailResponse = {
  id: 'doc-1',
  document_name: 'Test Document',
  description: 'A test doc',
  file_size_bytes: 204800,
  original_filename: 'test.pdf',
  mime_type: 'application/pdf',
  version: 1,
  status: 'PENDING',
  received_at: '2026-06-20T10:00:00.000Z',
  signed_at: null,
  expires_at: null,
  created_at: '2026-06-19T10:00:00.000Z',
  updated_at: '2026-06-20T10:00:00.000Z',
  sender: {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    deleted: false,
  },
  my_recipient: {
    id: 'rec-1',
    recipient_email: 'me@example.com',
    recipient_name: 'Me',
    signing_status: 'PENDING',
    first_accessed_at: null,
    last_accessed_at: null,
    signed_at: null,
    rejected_at: null,
    revoked_at: null,
  },
};

const AUTH_SESSION = {
  accessToken: 'valid.jwt',
  refreshToken: 'valid.rt',
  expiresAt: Date.now() + 60000,
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
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem(SESSION_KEY, JSON.stringify(AUTH_SESSION));
});

afterEach(() => {
  localStorage.removeItem(SESSION_KEY);
});

describe('useReceivedDocumentDetail', () => {
  it('starts with no document selected', () => {
    const { result } = renderHook(() => useReceivedDocumentDetail());

    expect(result.current.selectedDocument).toBeNull();
    expect(result.current.isDetailModalOpen).toBe(false);
    expect(result.current.isModalDetailLoading).toBe(false);
  });

  it('loads and caches document detail on showDocument', async () => {
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useReceivedDocumentDetail());

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    expect(result.current.selectedDocument).toEqual(MOCK_DETAIL);
    expect(result.current.isDetailModalOpen).toBe(true);
    expect(mockGetReceivedDocumentByIdApi).toHaveBeenCalledTimes(1);

    // Second call should use cache
    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    expect(mockGetReceivedDocumentByIdApi).toHaveBeenCalledTimes(1);
  });

  it('does not cache detail across different document ids', async () => {
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useReceivedDocumentDetail());

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    expect(mockGetReceivedDocumentByIdApi).toHaveBeenCalledTimes(1);

    mockGetReceivedDocumentByIdApi.mockResolvedValue({
      ...MOCK_DETAIL,
      id: 'doc-2',
      document_name: 'Doc 2',
    });

    await act(async () => {
      await result.current.showDocument('doc-2');
    });

    expect(mockGetReceivedDocumentByIdApi).toHaveBeenCalledTimes(2);
    expect(result.current.selectedDocument?.document_name).toBe('Doc 2');
  });

  it('closes detail modal and clears selection', async () => {
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useReceivedDocumentDetail());

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    expect(result.current.isDetailModalOpen).toBe(true);

    act(() => {
      result.current.closeDetail();
    });

    expect(result.current.isDetailModalOpen).toBe(false);
    expect(result.current.selectedDocument).toBeNull();
  });

  it('opens document download in new tab and returns blob URL', async () => {
    const originalOpen = window.open;
    window.open = vi.fn(() => ({ opener: null }) as Window);
    URL.createObjectURL = vi.fn(
      () => 'blob:doc-url',
    ) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(
      new Blob([new Uint8Array([112, 100, 102])]),
    );

    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useReceivedDocumentDetail());

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    let blobUrl: string | undefined;
    await act(async () => {
      blobUrl = await result.current.openDocument();
    });

    expect(blobUrl).toBe('blob:doc-url');
    expect(window.open).toHaveBeenCalledWith('blob:doc-url', '_blank');
    expect(mockFetchDocumentDownloadBlobUrl).toHaveBeenCalledWith('doc-1');
    expect(URL.createObjectURL).toHaveBeenCalled();

    window.open = originalOpen;
  });

  it('throws DOWNLOAD_FAILED_401 when download returns 401', async () => {
    mockFetchDocumentDownloadBlobUrl.mockRejectedValue(
      new Error('DOWNLOAD_FAILED_401'),
    );

    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useReceivedDocumentDetail());

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    await expect(async () => {
      await act(async () => {
        await result.current.openDocument();
      });
    }).rejects.toThrow('DOWNLOAD_FAILED_401');
  });

  it('sets actionFlowDocId when starting an action flow', async () => {
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useReceivedDocumentDetail());

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    act(() => {
      result.current.startActionFlow('SIGN');
    });

    expect(result.current.actionFlowDocId).toBe('doc-1');
    expect(result.current.pendingAction).toBe('SIGN');
  });

  it('resets action flow state on closeActionFlow', async () => {
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const { result } = renderHook(() => useReceivedDocumentDetail());

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    act(() => {
      result.current.startActionFlow('SIGN');
    });

    act(() => {
      result.current.closeActionFlow();
    });

    expect(result.current.actionFlowDocId).toBeNull();
    expect(result.current.pendingAction).toBeNull();
  });

  it('returns detailModal as null when no options are provided', () => {
    const { result } = renderHook(() => useReceivedDocumentDetail());

    expect(result.current.detailModal).toBeNull();
  });

  it('returns non-null detailModal when options provided and modal is open', async () => {
    mockGetReceivedDocumentByIdApi.mockResolvedValue(MOCK_DETAIL);

    const dummyOptions = {
      t: (key: string) => key,
      formatFileSize: (bytes: number) => `${bytes} B`,
      getStatusPresentation: () => ({
        label: 'Pending',
        color: '#000',
        bg: '#fff',
      }),
      onStartActionFlow: () => {},
    };

    const { result } = renderHook(() =>
      useReceivedDocumentDetail(dummyOptions),
    );

    // Before opening, modal is null
    expect(result.current.detailModal).toBeNull();

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    // After opening with options, modal is rendered
    expect(result.current.detailModal).not.toBeNull();
  });

  it('shows deleted-sender warning and disables action buttons', async () => {
    mockGetReceivedDocumentByIdApi.mockResolvedValue({
      ...MOCK_DETAIL,
      sender: { ...MOCK_DETAIL.sender, deleted: true },
    });

    const dummyOptions = {
      t: (key: string) => key,
      formatFileSize: (bytes: number) => `${bytes} B`,
      getStatusPresentation: () => ({
        label: 'Pending',
        color: '#000',
        bg: '#fff',
      }),
      onStartActionFlow: () => {},
    };

    const { result } = renderHook(() =>
      useReceivedDocumentDetail(dummyOptions),
    );

    await act(async () => {
      await result.current.showDocument('doc-1');
    });

    render(result.current.detailModal);

    expect(screen.getByText('modal.sender_deleted')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'document_actions.reject' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'document_actions.sign' }),
    ).toBeDisabled();
  });
});

// ── fetchDownloadDataUrl unit tests ─────────────────────────────────────────

function createPdfBlob(size: number): Blob {
  const bytes = new Uint8Array(size);
  if (size > 0) {
    // Valid PDF header: %PDF-
    bytes[0] = 0x25; // %
    bytes[1] = 0x50; // P
    bytes[2] = 0x44; // D
    bytes[3] = 0x46; // F
    bytes[4] = 0x2d; // -
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

describe('fetchDownloadDataUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a data:application/pdf;base64 URL for normal PDF (<50MB)', async () => {
    const blob = createPdfBlob(1024);
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(blob);

    const result = await fetchDownloadDataUrl('doc-normal');

    expect(result).toMatch(/^data:application\/pdf;base64,/);
    expect(mockFetchDocumentDownloadBlobUrl).toHaveBeenCalledWith('doc-normal');
  });

  it('returns a valid data URL for empty PDF (0 bytes)', async () => {
    const blob = createPdfBlob(0);
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(blob);

    const result = await fetchDownloadDataUrl('doc-empty');

    expect(result).toMatch(/^data:application\/pdf;base64,/);
    expect(mockFetchDocumentDownloadBlobUrl).toHaveBeenCalledWith('doc-empty');
  });

  it('falls back to window.open and throws PDF_TOO_LARGE_FOR_PREVIEW for oversized PDF', async () => {
    const largeBlob = createPdfBlob(60 * 1024 * 1024); // 60 MB
    // Override the size property — createPdfBlob creates a real Blob so
    // we need to set size on the prototype or use Object.defineProperty.
    // We'll use a spy to control what the Blob reports.
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(largeBlob);
    // JSDOM Blob.size is actually correct for the given bytes, so for a real
    // 60MB Uint8Array this would be 60MB. But creating a 60MB array in tests
    // is slow. We'll mock the size by spying on the getter.
    const sizeSpy = vi
      .spyOn(largeBlob, 'size', 'get')
      .mockReturnValue(60 * 1024 * 1024);

    const originalOpen = window.open;
    const openSpy = vi.fn(() => ({ opener: null }) as Window);
    window.open = openSpy;

    URL.createObjectURL = vi.fn(
      () => 'blob:oversized-url',
    ) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;

    await expect(fetchDownloadDataUrl('doc-oversized')).rejects.toThrow(
      'PDF_TOO_LARGE_FOR_PREVIEW',
    );
    expect(openSpy).toHaveBeenCalledWith('blob:oversized-url', '_blank');

    sizeSpy.mockRestore();
    window.open = originalOpen;
  });

  it('propagates network error from fetchDocumentDownloadBlobUrl', async () => {
    mockFetchDocumentDownloadBlobUrl.mockRejectedValue(
      new Error('Network Error'),
    );

    await expect(fetchDownloadDataUrl('doc-network-fail')).rejects.toThrow(
      'Network Error',
    );
  });

  it('throws FILE_READER_ERROR when FileReader fails', async () => {
    const blob = createPdfBlob(128);
    mockFetchDocumentDownloadBlobUrl.mockResolvedValue(blob);

    // Simulate FileReader failure by replacing readAsDataURL entirely
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(
      function (this: FileReader) {
        // Trigger the error callback directly — do NOT call the real impl
        if (this.onerror) {
          this.onerror(new ProgressEvent('error') as ProgressEvent<FileReader>);
        }
      },
    );

    await expect(fetchDownloadDataUrl('doc-reader-fail')).rejects.toThrow(
      'FILE_READER_ERROR',
    );

    vi.mocked(FileReader.prototype.readAsDataURL).mockRestore();
  });
});
