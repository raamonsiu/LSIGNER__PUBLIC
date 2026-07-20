'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSentRecipientsApi,
  getReceivedDocumentsApi,
} from '@/lib/api/endpoints/documents';
import { useWizard } from '@/components/providers/SendDocumentWizardProvider';
import type {
  SentRecipientsListResponse,
  SentRecipientListItem,
  ReceivedDocumentsListResponse,
  ReceivedDocumentsListItem,
} from '@/lib/api/endpoints/types';

// === Types ====================================================================

/** Normalized shape for a recent document row on the dashboard. */
export interface DashboardRecentItem {
  /** Unique row key: `sent-{document_id}` or `received-{id}`. */
  id: string;
  /** Actual document ID for API calls (detail fetch, navigation). */
  documentId: string;
  /** Whether this document was sent or received. */
  direction: 'sent' | 'received';
  /** Display name of the document. */
  documentName: string;
  /** Sender name (received) or recipient name (sent). Falls back to email. */
  otherParty: string;
  /** ISO timestamp (sent_at or received_at). */
  date: string;
  /** signing_status (sent) or status (received). */
  status: string;
  /** File size in bytes. */
  fileSizeBytes: number;
  /** Recipient email (sent direction only). Needed for the detail modal. */
  recipientEmail: string | null;
}

export interface DashboardData {
  /** Full response from GET /documents/sent/recipients. */
  sentData: SentRecipientsListResponse | null;
  /** Full response from GET /documents/received. */
  receivedData: ReceivedDocumentsListResponse | null;
  /** True while either API call is in flight. */
  loading: boolean;
  /** Error message from the most recent fetch, or null. */
  error: string | null;
  /**
   * Re-fetch both APIs. Clears any existing error and resets loading state.
   * Use after a wizard finish to refresh the dashboard.
   */
  refetch: () => Promise<void>;
}

// === Helpers =================================================================

/**
 * Merges sent recipients and received documents into a unified,
 * date-descending list of recent items, capped at 10.
 */
export function normalizeRecentItems(
  sentItems: SentRecipientListItem[],
  receivedItems: ReceivedDocumentsListItem[],
): DashboardRecentItem[] {
  const sent: DashboardRecentItem[] = sentItems.map((sentItem) => ({
    id: `sent-${sentItem.document_id}`,
    documentId: sentItem.document_id,
    direction: 'sent' as const,
    documentName: sentItem.document_name,
    otherParty: sentItem.recipient_name || sentItem.recipient_email,
    date: sentItem.sent_at,
    status: sentItem.signing_status,
    fileSizeBytes: 0, // sent recipients list doesn't include file size
    recipientEmail: sentItem.recipient_email,
  }));

  const received: DashboardRecentItem[] = receivedItems.map((r) => ({
    id: `received-${r.id}`,
    documentId: r.id,
    direction: 'received' as const,
    documentName: r.document_name,
    otherParty: r.sender_name || r.sender_email,
    date: r.received_at,
    status: r.status,
    fileSizeBytes: r.file_size_bytes,
    recipientEmail: null,
  }));

  return [...sent, ...received]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
}

// === Hook =====================================================================

/**
 * Fetches sent recipients and received documents in parallel on mount,
 * and re-fetches whenever the global send wizard finishes (closeCount increments).
 */
export function useDashboardData(): DashboardData {
  const [sentData, setSentData] = useState<SentRecipientsListResponse | null>(
    null,
  );
  const [receivedData, setReceivedData] =
    useState<ReceivedDocumentsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { closeCount } = useWizard();

  // Track whether this is the initial fetch to avoid flickering loading state
  // on subsequent refetches
  const initialFetchDone = useRef(false);

  const fetch = useCallback(async () => {
    setError(null);
    if (!initialFetchDone.current) {
      setLoading(true);
    }

    const [sentResult, receivedResult] = await Promise.allSettled([
      getSentRecipientsApi(),
      getReceivedDocumentsApi(),
    ]);
    if (sentResult.status === 'fulfilled') setSentData(sentResult.value);
    if (receivedResult.status === 'fulfilled')
      setReceivedData(receivedResult.value);
    // Only set error if BOTH failed
    if (
      sentResult.status === 'rejected' &&
      receivedResult.status === 'rejected'
    ) {
      setError('Failed to load dashboard data');
    }

    setLoading(false);
    initialFetchDone.current = true;
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetch();
  }, [fetch]);

  // Re-fetch when the wizard finishes (closeCount increments)
  const prevCloseCount = useRef(closeCount);
  useEffect(() => {
    if (closeCount > prevCloseCount.current) {
      prevCloseCount.current = closeCount;
      void fetch();
    }
  }, [closeCount, fetch]);

  return { sentData, receivedData, loading, error, refetch: fetch };
}
