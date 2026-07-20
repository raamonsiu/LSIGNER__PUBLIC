import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReceivedDocuments } from './useReceivedDocuments';
import type {
  ReceivedDocumentsListResponse,
  PrivateDocumentLockStatus,
} from '@/lib/api/endpoints/types';

const mockGetReceivedDocumentsApi = vi.fn();
const mockGetPrivateDocumentLocksApi = vi.fn();

vi.mock('@/lib/api/endpoints/documents', () => ({
  getReceivedDocumentsApi: () => mockGetReceivedDocumentsApi(),
}));

vi.mock('@/lib/api/endpoints/document-locks', () => ({
  getPrivateDocumentLocksApi: (documentId: string) =>
    mockGetPrivateDocumentLocksApi(documentId),
}));

const MOCK_LIST: ReceivedDocumentsListResponse = {
  stats: {
    total_received: 3,
    pending_my_signature: 1,
    signed_by_me: 1,
    rejected_or_revoked: 1,
  },
  items: [
    {
      id: 'doc-1',
      document_name: 'Doc A',
      file_size_bytes: 1000,
      received_at: '2026-06-20T10:00:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'Alice',
      sender_email: 'a@b.com',
      status: 'PENDING',
    },
    {
      id: 'doc-2',
      document_name: 'Doc B',
      file_size_bytes: 2000,
      received_at: '2026-06-19T10:00:00.000Z',
      signed_at: '2026-06-20T12:00:00.000Z',
      expires_at: null,
      sender_name: null,
      sender_email: 'b@c.com',
      status: 'SIGNED',
    },
    {
      id: 'doc-3',
      document_name: 'Doc C',
      file_size_bytes: 500,
      received_at: '2026-06-18T10:00:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'Charlie',
      sender_email: 'c@d.com',
      status: 'REJECTED',
    },
  ],
};

const MOCK_LOCK: PrivateDocumentLockStatus = {
  id: 'lock-1',
  lock_type: 'PASSWORD',
  is_resolved: false,
  resolved_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useReceivedDocuments', () => {
  it('starts in loading state', () => {
    mockGetReceivedDocumentsApi.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useReceivedDocuments());

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('loads documents and sets data on success', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST);

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(MOCK_LIST);
    expect(result.current.error).toBeNull();
  });

  it('sets error on API failure', async () => {
    mockGetReceivedDocumentsApi.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('load_error');
    expect(result.current.data).toBeNull();
  });

  it('sorts items: unsigned first by received_at desc, then signed by signed_at desc', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST);

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const ids = result.current.sortedItems.map((i) => i.id);
    expect(ids).toEqual(['doc-1', 'doc-3', 'doc-2']);
  });

  it('fetches lock status for PENDING documents', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST);
    mockGetPrivateDocumentLocksApi.mockResolvedValue([MOCK_LOCK]);

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetPrivateDocumentLocksApi).toHaveBeenCalledWith('doc-1');
    expect(mockGetPrivateDocumentLocksApi).not.toHaveBeenCalledWith('doc-2');
    expect(mockGetPrivateDocumentLocksApi).not.toHaveBeenCalledWith('doc-3');

    await waitFor(() => {
      expect(result.current.docLockData['doc-1']).toBeDefined();
    });

    expect(result.current.docLockData['doc-1']!.isBlocked).toBe(true);
  });

  it('marks doc as not blocked when all locks resolved', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST);
    mockGetPrivateDocumentLocksApi.mockResolvedValue([
      { ...MOCK_LOCK, is_resolved: true },
    ]);

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.docLockData['doc-1']).toBeDefined();
    });

    expect(result.current.docLockData['doc-1']!.isBlocked).toBe(false);
  });

  it('provides updateDocumentStatus to optimistically update list', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST);
    mockGetPrivateDocumentLocksApi.mockResolvedValue([MOCK_LOCK]);

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.data).toEqual(MOCK_LIST);
    });

    result.current.updateDocumentStatus('doc-1', 'SIGNED');

    await waitFor(() => {
      expect(
        result.current.data!.items.find((i) => i.id === 'doc-1')!.status,
      ).toBe('SIGNED');
    });
    expect(
      result.current.data!.items.find((i) => i.id === 'doc-2')!.status,
    ).toBe('SIGNED');
  });

  it('provides refreshDocuments to re-fetch list', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST);

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updatedList = {
      ...MOCK_LIST,
      stats: { ...MOCK_LIST.stats, total_received: 5 },
    };
    mockGetReceivedDocumentsApi.mockResolvedValue(updatedList);

    await result.current.refreshDocuments();

    await waitFor(() => {
      expect(result.current.data!.stats!.total_received).toBe(5);
    });
  });

  it('handles lock fetch error gracefully without crashing', async () => {
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_LIST);
    mockGetPrivateDocumentLocksApi.mockRejectedValue(new Error('Lock error'));

    const { result } = renderHook(() => useReceivedDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.docLockData['doc-1']).toBeDefined();
    });

    // On error, locks should be empty and not blocked
    expect(result.current.docLockData['doc-1']!.isBlocked).toBe(false);
    expect(result.current.docLockData['doc-1']!.locks).toEqual([]);
  });
});
