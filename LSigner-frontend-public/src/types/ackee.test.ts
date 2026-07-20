import { describe, expect, it, vi } from 'vitest';

describe('Ackee global typing contract', () => {
  it('supports a typed tracker on window', () => {
    const stop = vi.fn();
    const record = vi.fn<
      (
        domainId: string,
        attributes?: Record<string, unknown>,
      ) => AckeeRecordHandle
    >(() => ({ stop }));

    const tracker: AckeeTracker = { record };
    window.ackeeTracker = tracker;

    const handle = window.ackeeTracker?.record('507f1f77bcf86cd799439011', {
      siteLocation: 'https://example.com/dashboard',
    });

    handle?.stop();

    expect(record).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      siteLocation: 'https://example.com/dashboard',
    });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
