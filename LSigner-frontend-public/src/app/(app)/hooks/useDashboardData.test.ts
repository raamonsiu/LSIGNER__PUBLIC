import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboardData, normalizeRecentItems } from './useDashboardData';
import type {
  SentRecipientsListResponse,
  ReceivedDocumentsListResponse,
} from '@/lib/api/endpoints/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSentRecipientsApi = vi.fn();
const mockGetReceivedDocumentsApi = vi.fn();

vi.mock('@/lib/api/endpoints/documents', () => ({
  getSentRecipientsApi: () => mockGetSentRecipientsApi(),
  getReceivedDocumentsApi: () => mockGetReceivedDocumentsApi(),
}));

// Dynamic closeCount so tests can simulate wizard finishes
let mockCloseCount = 0;
const mockOpenWizard = vi.fn();
const mockCloseWizard = vi.fn();
const mockFinishWizard = vi.fn();

vi.mock('@/components/providers/SendDocumentWizardProvider', () => ({
  useWizard: () => ({
    closeCount: mockCloseCount,
    openWizard: mockOpenWizard,
    closeWizard: mockCloseWizard,
    finishWizard: mockFinishWizard,
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_SENT_RESPONSE: SentRecipientsListResponse = {
  stats: { total: 5, pending: 3, signed: 1, rejected: 0, revoked: 1 },
  items: [
    {
      recipient_email: 'maria@example.com',
      recipient_name: 'María López',
      signing_status: 'PENDING',
      signed_at: null,
      sent_at: '2026-06-25T10:00:00.000Z',
      document_id: 'doc-sent-1',
      document_name: 'Contrato de Arrendamiento',
      first_accessed_at: '2026-06-25T11:00:00.000Z',
      last_accessed_at: '2026-06-26T09:00:00.000Z',
    },
    {
      recipient_email: 'carlos@example.com',
      recipient_name: 'Carlos Méndez',
      signing_status: 'SIGNED',
      signed_at: '2026-06-24T15:00:00.000Z',
      sent_at: '2026-06-24T10:00:00.000Z',
      document_id: 'doc-sent-2',
      document_name: 'Contrato de Servicios',
      first_accessed_at: null,
      last_accessed_at: null,
    },
  ],
};

const MOCK_RECEIVED_RESPONSE: ReceivedDocumentsListResponse = {
  stats: {
    total_received: 4,
    pending_my_signature: 2,
    signed_by_me: 1,
    rejected_or_revoked: 1,
  },
  items: [
    {
      id: 'doc-rec-1',
      document_name: 'NDA — ABC Corp',
      file_size_bytes: 204800,
      received_at: '2026-06-26T14:00:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'Ana Rodríguez',
      sender_email: 'ana@example.com',
      status: 'PENDING',
    },
    {
      id: 'doc-rec-2',
      document_name: 'Acuerdo Comercial 2026',
      file_size_bytes: 307200,
      received_at: '2026-06-20T08:00:00.000Z',
      signed_at: '2026-06-22T12:00:00.000Z',
      expires_at: null,
      sender_name: 'Laura Vega',
      sender_email: 'laura@example.com',
      status: 'SIGNED',
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCloseCount = 0;
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('starts in loading state with null data and no error', () => {
    // Never resolve the promises to keep it loading
    mockGetSentRecipientsApi.mockReturnValue(new Promise(() => { }));
    mockGetReceivedDocumentsApi.mockReturnValue(new Promise(() => { }));

    const { result } = renderHook(() => useDashboardData());

    expect(result.current.loading).toBe(true);
    expect(result.current.sentData).toBeNull();
    expect(result.current.receivedData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // ── Success state ──────────────────────────────────────────────────────────

  it('sets sentData and receivedData when both APIs succeed', async () => {
    mockGetSentRecipientsApi.mockResolvedValue(MOCK_SENT_RESPONSE);
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_RECEIVED_RESPONSE);

    const { result } = renderHook(() => useDashboardData());

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sentData).toEqual(MOCK_SENT_RESPONSE);
    expect(result.current.receivedData).toEqual(MOCK_RECEIVED_RESPONSE);
    expect(result.current.error).toBeNull();
  });

  it('calls both APIs in parallel (both are started before any await)', async () => {
    const sentPromise = Promise.resolve(MOCK_SENT_RESPONSE);
    const receivedPromise = Promise.resolve(MOCK_RECEIVED_RESPONSE);

    mockGetSentRecipientsApi.mockReturnValue(sentPromise);
    mockGetReceivedDocumentsApi.mockReturnValue(receivedPromise);

    renderHook(() => useDashboardData());

    // Both APIs must have been called before the promises resolve
    expect(mockGetSentRecipientsApi).toHaveBeenCalledTimes(1);
    expect(mockGetReceivedDocumentsApi).toHaveBeenCalledTimes(1);
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it('preserves received data when getSentRecipientsApi fails', async () => {
    mockGetSentRecipientsApi.mockRejectedValue(new Error('Network error'));
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_RECEIVED_RESPONSE);

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Only sent failed — no error (must have both fail for error)
    expect(result.current.error).toBeNull();
    expect(result.current.sentData).toBeNull();
    // received should still succeed
    expect(result.current.receivedData).toEqual(MOCK_RECEIVED_RESPONSE);
  });

  it('preserves sent data when getReceivedDocumentsApi fails', async () => {
    mockGetSentRecipientsApi.mockResolvedValue(MOCK_SENT_RESPONSE);
    mockGetReceivedDocumentsApi.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Only received failed — no error (must have both fail for error)
    expect(result.current.error).toBeNull();
    expect(result.current.sentData).toEqual(MOCK_SENT_RESPONSE);
    expect(result.current.receivedData).toBeNull();
  });

  it('clears loading even when both APIs fail', async () => {
    mockGetSentRecipientsApi.mockRejectedValue(new Error('A'));
    mockGetReceivedDocumentsApi.mockRejectedValue(new Error('B'));

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load dashboard data');
    expect(result.current.loading).toBe(false);
  });

  // ── Refetch ────────────────────────────────────────────────────────────────

  it('refetch clears error, resets loading, and re-fetches both APIs', async () => {
    // First call: sent fails, received succeeds — partial failure, no error
    mockGetSentRecipientsApi.mockRejectedValueOnce(new Error('First fail'));
    mockGetReceivedDocumentsApi.mockResolvedValueOnce(MOCK_RECEIVED_RESPONSE);

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Partial failure — no error, received data is preserved
    expect(result.current.error).toBeNull();
    expect(result.current.receivedData).toEqual(MOCK_RECEIVED_RESPONSE);

    // Setup second call to succeed
    mockGetSentRecipientsApi.mockResolvedValue(MOCK_SENT_RESPONSE);
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_RECEIVED_RESPONSE);

    // Call refetch
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.sentData).toEqual(MOCK_SENT_RESPONSE);
    expect(result.current.receivedData).toEqual(MOCK_RECEIVED_RESPONSE);
    expect(result.current.loading).toBe(false);

    // Both APIs called twice total (initial + refetch)
    expect(mockGetSentRecipientsApi).toHaveBeenCalledTimes(2);
    expect(mockGetReceivedDocumentsApi).toHaveBeenCalledTimes(2);
  });

  // ── closeCount triggers refetch ────────────────────────────────────────────

  it('re-fetches both APIs when closeCount increments (wizard finished)', async () => {
    mockGetSentRecipientsApi.mockResolvedValue(MOCK_SENT_RESPONSE);
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_RECEIVED_RESPONSE);

    const { result, rerender } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetSentRecipientsApi).toHaveBeenCalledTimes(1);
    expect(mockGetReceivedDocumentsApi).toHaveBeenCalledTimes(1);

    // Simulate wizard finish — closeCount increments
    mockCloseCount = 1;

    // The hook watches closeCount in a useEffect. We need to rerender
    // so the hook captures the updated mock value.
    rerender();

    await waitFor(() => {
      expect(mockGetSentRecipientsApi).toHaveBeenCalledTimes(2);
    });

    expect(mockGetReceivedDocumentsApi).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-fetch when closeCount is 0 (initial value)', async () => {
    mockGetSentRecipientsApi.mockResolvedValue(MOCK_SENT_RESPONSE);
    mockGetReceivedDocumentsApi.mockResolvedValue(MOCK_RECEIVED_RESPONSE);

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Only the initial fetch
    expect(mockGetSentRecipientsApi).toHaveBeenCalledTimes(1);
  });
});

// ─── normalizeRecentItems ─────────────────────────────────────────────────────

describe('normalizeRecentItems', () => {
  const sentItems = [
    {
      recipient_email: 'maria@example.com',
      recipient_name: 'María López',
      signing_status: 'PENDING' as const,
      signed_at: null,
      sent_at: '2026-06-28T10:00:00.000Z',
      document_id: 'doc-sent-1',
      document_name: 'Contrato de Arrendamiento',
      first_accessed_at: null,
      last_accessed_at: null,
    },
    {
      recipient_email: 'carlos@example.com',
      recipient_name: null,
      signing_status: 'SIGNED' as const,
      signed_at: '2026-06-24T15:00:00.000Z',
      sent_at: '2026-06-24T10:00:00.000Z',
      document_id: 'doc-sent-2',
      document_name: 'Contrato de Servicios',
      first_accessed_at: null,
      last_accessed_at: null,
    },
  ];

  const receivedItems = [
    {
      id: 'doc-rec-1',
      document_name: 'NDA — ABC Corp',
      file_size_bytes: 204800,
      received_at: '2026-06-29T14:00:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'Ana Rodríguez',
      sender_email: 'ana@example.com',
      status: 'PENDING' as const,
    },
    {
      id: 'doc-rec-2',
      document_name: 'Acuerdo Comercial',
      file_size_bytes: 307200,
      received_at: '2026-06-27T08:00:00.000Z',
      signed_at: '2026-06-27T12:00:00.000Z',
      expires_at: null,
      sender_name: null,
      sender_email: 'laura@example.com',
      status: 'SIGNED' as const,
    },
  ];

  it('maps sent items to DashboardRecentItem with direction "sent"', () => {
    const result = normalizeRecentItems(sentItems, []);

    const sentResult = result.find((r) => r.id === 'sent-doc-sent-1');
    expect(sentResult).toBeDefined();
    expect(sentResult?.direction).toBe('sent');
    expect(sentResult?.documentName).toBe('Contrato de Arrendamiento');
    expect(sentResult?.otherParty).toBe('María López');
    expect(sentResult?.status).toBe('PENDING');
    expect(sentResult?.documentId).toBe('doc-sent-1');
    expect(sentResult?.date).toBe('2026-06-28T10:00:00.000Z');
  });

  it('maps received items to DashboardRecentItem with direction "received"', () => {
    const result = normalizeRecentItems([], receivedItems);

    const receivedResult = result.find((r) => r.id === 'received-doc-rec-2');
    expect(receivedResult).toBeDefined();
    expect(receivedResult?.direction).toBe('received');
    expect(receivedResult?.documentName).toBe('Acuerdo Comercial');
    expect(receivedResult?.status).toBe('SIGNED');
    expect(receivedResult?.documentId).toBe('doc-rec-2');
  });

  it('falls back to email when otherParty name is null', () => {
    const result = normalizeRecentItems(sentItems, receivedItems);

    // sent item with null name -> falls back to email
    const sentNullName = result.find((r) => r.id === 'sent-doc-sent-2');
    expect(sentNullName?.otherParty).toBe('carlos@example.com');

    // received item with null sender_name -> falls back to email
    const receivedNullName = result.find((r) => r.id === 'received-doc-rec-2');
    expect(receivedNullName?.otherParty).toBe('laura@example.com');
  });

  it('sorts merged items by date descending', () => {
    const result = normalizeRecentItems(sentItems, receivedItems);

    // The most recent date should be first
    expect(result[0].date).toBe('2026-06-29T14:00:00.000Z'); // received item
    expect(result[1].date).toBe('2026-06-28T10:00:00.000Z'); // sent item
    expect(result[2].date).toBe('2026-06-27T08:00:00.000Z'); // received item
    expect(result[3].date).toBe('2026-06-24T10:00:00.000Z'); // sent item
  });

  it('handles empty arrays gracefully', () => {
    const result = normalizeRecentItems([], []);
    expect(result).toHaveLength(0);
  });

  it('handles only sent items (no received)', () => {
    const result = normalizeRecentItems(sentItems, []);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.direction === 'sent')).toBe(true);
  });

  it('handles only received items (no sent)', () => {
    const result = normalizeRecentItems([], receivedItems);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.direction === 'received')).toBe(true);
  });

  it('slices to maximum 10 items when more are provided', () => {
    // Generate 15 items (should be sliced to 10)
    const manySent = Array.from({ length: 8 }, (_, i) => ({
      ...sentItems[0],
      document_id: `doc-sent-${i}`,
      sent_at: `2026-06-${(10 + i).toString().padStart(2, '0')}T10:00:00.000Z`,
    }));
    const manyReceived = Array.from({ length: 8 }, (_, i) => ({
      ...receivedItems[0],
      id: `doc-rec-${i}`,
      received_at: `2026-06-${(10 + i).toString().padStart(2, '0')}T14:00:00.000Z`,
    }));

    const result = normalizeRecentItems(manySent, manyReceived);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
