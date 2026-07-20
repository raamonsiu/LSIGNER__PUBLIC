'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getReceivedDocumentsApi } from '@/lib/api/endpoints/documents';
import { getPrivateDocumentLocksApi } from '@/lib/api/endpoints/document-locks';
import type {
  ReceivedDocumentsListItem,
  ReceivedDocumentsListResponse,
  SharedDocumentLockStatus,
} from '@/lib/api/endpoints/types';
import { normalizePrivateDocumentLock } from '@/app/(app)/documents/received/normalize-private-document-lock';

interface LockDocState {
  locks: SharedDocumentLockStatus[];
  isBlocked: boolean;
  loading: boolean;
}

interface UseReceivedDocumentsReturn {
  data: ReceivedDocumentsListResponse | null;
  loading: boolean;
  error: string | null;
  sortedItems: ReceivedDocumentsListItem[];
  docLockData: Record<string, LockDocState>;
  updateDocumentStatus: (
    documentId: string,
    newStatus: ReceivedDocumentsListItem['status'],
  ) => void;
  refreshDocuments: () => Promise<void>;
  refreshLockState: (documentId: string, lockState: LockDocState) => void;
  setDocLockData: React.Dispatch<
    React.SetStateAction<Record<string, LockDocState>>
  >;
}

function sortReceivedDocuments(
  items: ReceivedDocumentsListItem[],
): ReceivedDocumentsListItem[] {
  return [...items].sort((a, b) => {
    const aSignedAt = a.signed_at ? new Date(a.signed_at).getTime() : null;
    const bSignedAt = b.signed_at ? new Date(b.signed_at).getTime() : null;

    if (aSignedAt === null && bSignedAt !== null) return -1;
    if (aSignedAt !== null && bSignedAt === null) return 1;

    if (aSignedAt === null && bSignedAt === null) {
      return (
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      );
    }

    if (aSignedAt !== null && bSignedAt !== null && bSignedAt !== aSignedAt) {
      return bSignedAt - aSignedAt;
    }

    return (
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
  });
}

/**
 * Hook that manages received documents list fetching, lock state, and sorting.
 */
export function useReceivedDocuments(): UseReceivedDocumentsReturn {
  const [data, setData] = useState<ReceivedDocumentsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docLockData, setDocLockData] = useState<Record<string, LockDocState>>(
    {},
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchDocuments() {
      setLoading(true);
      setError(null);
      try {
        console.log('[useReceivedDocuments] fetching...');
        const response = await getReceivedDocumentsApi();
        console.log('[useReceivedDocuments] response:', response);
        if (!cancelled && mountedRef.current) {
          console.log('[useReceivedDocuments] setData with', response);
          setData(response);
        }
      } catch (err) {
        console.log('[useReceivedDocuments] error:', err);
        if (!cancelled && mountedRef.current) {
          setError('load_error');
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void fetchDocuments();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch lock status for PENDING docs
  useEffect(() => {
    const items = data?.items ?? [];
    const pendingItems = items.filter((item) => item.status === 'PENDING');

    if (pendingItems.length === 0) return;

    let cancelled = false;

    async function fetchLocksForDoc(documentItem: ReceivedDocumentsListItem) {
      try {
        setDocLockData((prev) => ({
          ...prev,
          [documentItem.id]: { locks: [], isBlocked: false, loading: true },
        }));

        const locks = await getPrivateDocumentLocksApi(documentItem.id);
        if (cancelled) return;

        const normalizedLocks: SharedDocumentLockStatus[] = locks.map((lock) =>
          normalizePrivateDocumentLock(lock),
        );
        const unresolvedLocks = normalizedLocks.filter(
          (lock) => !lock.is_resolved,
        );

        setDocLockData((prev) => ({
          ...prev,
          [documentItem.id]: {
            locks: normalizedLocks,
            isBlocked: unresolvedLocks.length > 0,
            loading: false,
          },
        }));
      } catch {
        if (cancelled) return;
        setDocLockData((prev) => ({
          ...prev,
          [documentItem.id]: { locks: [], isBlocked: false, loading: false },
        }));
      }
    }

    void Promise.all(pendingItems.map(fetchLocksForDoc));

    return () => {
      cancelled = true;
    };
  }, [data]);

  const sortedItems = useMemo(
    () => sortReceivedDocuments(data?.items ?? []),
    [data],
  );

  const updateDocumentStatus = useCallback(
    (documentId: string, newStatus: ReceivedDocumentsListItem['status']) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === documentId
              ? {
                  ...item,
                  status: newStatus,
                  signed_at:
                    newStatus === 'SIGNED'
                      ? new Date().toISOString()
                      : item.signed_at,
                }
              : item,
          ),
        };
      });
    },
    [],
  );

  const refreshDocuments = useCallback(async () => {
    try {
      const response = await getReceivedDocumentsApi();
      setData(response);
    } catch {
      // Silently handle refresh errors
    }
  }, []);

  const refreshLockState = useCallback(
    (documentId: string, lockState: LockDocState) => {
      setDocLockData((prev) => ({
        ...prev,
        [documentId]: lockState,
      }));
    },
    [],
  );

  return {
    data,
    loading,
    error,
    sortedItems,
    docLockData,
    updateDocumentStatus,
    refreshDocuments,
    refreshLockState,
    setDocLockData,
  };
}
