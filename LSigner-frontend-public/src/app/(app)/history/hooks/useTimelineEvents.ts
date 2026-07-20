import { useCallback, useEffect, useState } from 'react';
import { getTimelineApi } from '@/lib/api/endpoints/documents';
import type {
  TimelineItem,
  TimelineEventResponse,
} from '@/lib/api/endpoints/types';

const SKIP_ACTIONS = new Set(['ACCESS_OPENED']);
const SUPPORTED_ACTIONS = new Set<TimelineItem['eventType']>([
  'SENT',
  'RECEIVED',
  'SIGNED',
  'REJECTED',
  'REVOKED',
]);

function isSupportedTimelineAction(
  action: string,
): action is TimelineItem['eventType'] {
  return SUPPORTED_ACTIONS.has(action as TimelineItem['eventType']);
}

function toTimelineItem(event: TimelineEventResponse): TimelineItem | null {
  if (SKIP_ACTIONS.has(event.action)) return null;
  if (!isSupportedTimelineAction(event.action)) return null;

  return {
    id: event.event_id,
    direction: event.direction,
    documentName: event.document_name,
    otherPartyName: event.other_party_name ?? event.other_party_email,
    eventType: event.action,
    occurredAt: event.occurred_at,
    documentId: event.document_id,
  };
}

async function fetchTimeline(): Promise<TimelineItem[]> {
  const response = await getTimelineApi();
  return response.items
    .map(toTimelineItem)
    .filter((item): item is TimelineItem => item !== null);
}

export function useTimelineEvents() {
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchTimeline()
      .then((items) => {
        if (!cancelled) {
          setEvents(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Timeline fetch failed:', err);
          setEvents([]);
          setError('Failed to load history');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchTimeline()
      .then((items) => {
        setEvents(items);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Timeline fetch failed:', err);
        setEvents([]);
        setError('Failed to load history');
        setLoading(false);
      });
  }, []);

  return { events, loading, error, retry };
}
