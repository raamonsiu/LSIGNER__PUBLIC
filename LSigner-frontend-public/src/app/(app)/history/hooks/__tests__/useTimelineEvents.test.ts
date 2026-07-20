import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTimelineEvents } from '../useTimelineEvents';
import type { TimelineEventResponse } from '@/lib/api/endpoints/types';

vi.mock('@/lib/api/endpoints/documents', () => ({
  getTimelineApi: vi.fn(),
}));

import { getTimelineApi } from '@/lib/api/endpoints/documents';

function makeEvent(
  overrides: Partial<TimelineEventResponse> = {},
): TimelineEventResponse {
  return {
    event_id: 'evt-1',
    document_id: 'doc-1',
    document_name: 'Test.pdf',
    action: 'SENT',
    occurred_at: '2026-06-01T10:00:00.000Z',
    direction: 'sent',
    other_party_name: 'Alice',
    other_party_email: 'alice@example.com',
    ...overrides,
  };
}

function mockApi(items: TimelineEventResponse[]) {
  vi.mocked(getTimelineApi).mockResolvedValue({ items });
}

function mockApiRejection() {
  vi.mocked(getTimelineApi).mockRejectedValue(new Error('Network error'));
}

function pendingPromise() {
  return new Promise<never>(() => {});
}

describe('useTimelineEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with loading=true and empty events', () => {
    vi.mocked(getTimelineApi).mockReturnValue(pendingPromise());
    const { result } = renderHook(() => useTimelineEvents());
    expect(result.current.loading).toBe(true);
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns empty when no events exist', async () => {
    mockApi([]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  it('maps SENT event correctly', async () => {
    mockApi([
      makeEvent({
        action: 'SENT',
        direction: 'sent',
        occurred_at: '2026-06-01T10:00:00.000Z',
      }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].eventType).toBe('SENT');
    expect(result.current.events[0].direction).toBe('sent');
  });

  it('maps RECEIVED event correctly', async () => {
    mockApi([
      makeEvent({
        action: 'RECEIVED',
        direction: 'received',
        other_party_name: 'Bob',
      }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events[0].eventType).toBe('RECEIVED');
    expect(result.current.events[0].otherPartyName).toBe('Bob');
  });

  it('produces SENT + SIGNED when both exist for same document', async () => {
    mockApi([
      makeEvent({
        event_id: 'evt-2',
        action: 'SIGNED',
        occurred_at: '2026-06-03T12:00:00.000Z',
        direction: 'sent',
      }),
      makeEvent({
        event_id: 'evt-1',
        action: 'SENT',
        occurred_at: '2026-06-01T10:00:00.000Z',
        direction: 'sent',
      }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0].eventType).toBe('SIGNED');
    expect(result.current.events[1].eventType).toBe('SENT');
  });

  it('filters out ACCESS_OPENED events', async () => {
    mockApi([
      makeEvent({ action: 'ACCESS_OPENED', event_id: 'evt-1' }),
      makeEvent({ action: 'SENT', event_id: 'evt-2' }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].eventType).toBe('SENT');
  });

  it('filters out unknown event actions to avoid UI crashes', async () => {
    mockApi([
      makeEvent({ action: 'RECIPIENT_ACCOUNT_DELETED', event_id: 'evt-1' }),
      makeEvent({ action: 'SENT', event_id: 'evt-2' }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].eventType).toBe('SENT');
  });

  it('sets error when API fails', async () => {
    mockApiRejection();
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.events).toEqual([]);
  });

  it('retry recovers from error', async () => {
    mockApiRejection();
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.error).toBeTruthy());

    mockApi([makeEvent({ action: 'SENT' })]);
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.events).toHaveLength(1);
  });

  it('preserves server event order', async () => {
    mockApi([
      makeEvent({
        action: 'RECEIVED',
        occurred_at: '2026-06-05T15:00:00.000Z',
        event_id: 'evt-2',
      }),
      makeEvent({
        action: 'SENT',
        occurred_at: '2026-06-03T10:00:00.000Z',
        event_id: 'evt-1',
      }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events[0].occurredAt).toBe(
      '2026-06-05T15:00:00.000Z',
    );
    expect(result.current.events[1].occurredAt).toBe(
      '2026-06-03T10:00:00.000Z',
    );
  });

  it('preserves order from API (server-sorted)', async () => {
    mockApi([
      makeEvent({
        action: 'SENT',
        occurred_at: '2026-06-01T10:00:00.000Z',
        event_id: 'evt-3',
      }),
      makeEvent({
        action: 'REVOKED',
        occurred_at: '2026-06-01T10:00:00.000Z',
        event_id: 'evt-1',
      }),
      makeEvent({
        action: 'SIGNED',
        occurred_at: '2026-06-01T10:00:00.000Z',
        event_id: 'evt-2',
      }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const types = result.current.events.map((e) => e.eventType);
    expect(types).toEqual(['SENT', 'REVOKED', 'SIGNED']);
  });

  it('falls back to email when other_party_name is null', async () => {
    mockApi([
      makeEvent({
        action: 'SENT',
        other_party_name: null,
        other_party_email: 'no-name@example.com',
      }),
    ]);
    const { result } = renderHook(() => useTimelineEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events[0].otherPartyName).toBe('no-name@example.com');
  });
});
