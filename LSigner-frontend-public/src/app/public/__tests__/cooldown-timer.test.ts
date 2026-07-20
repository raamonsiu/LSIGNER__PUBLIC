import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for the recursive setTimeout cooldown pattern.
 * This verifies that the useEffect-based countdown behaves correctly
 * (same as the received page pattern).
 */

describe('Cooldown timer pattern', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down from N to 0 with recursive setTimeout', () => {
    let cooldown = 5;
    const setCooldown = (next: number | ((prev: number) => number)) => {
      cooldown = typeof next === 'function' ? next(cooldown) : next;
    };

    const tick = () => {
      if (cooldown <= 0) return;
      setCooldown((prev: number) => (prev > 0 ? prev - 1 : 0));
    };

    // Simulate the recursive setTimeout pattern
    const scheduleNext = () => {
      if (cooldown <= 0) return;
      const timer = setTimeout(() => {
        tick();
        scheduleNext();
      }, 1000);
      return timer;
    };

    const timer = scheduleNext();

    // After 1 second
    vi.advanceTimersByTime(1000);
    expect(cooldown).toBe(4);

    // After 3 more seconds (total 4)
    vi.advanceTimersByTime(3000);
    expect(cooldown).toBe(1);

    // After 1 more second (total 5)
    vi.advanceTimersByTime(1000);
    expect(cooldown).toBe(0);

    // Timer should not fire again
    vi.advanceTimersByTime(5000);
    expect(cooldown).toBe(0);

    clearTimeout(timer);
  });

  it('useEffect cleanup clears the pending timeout', () => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cooldown = 3;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Start the timer
    timeoutId = setTimeout(() => {
      cooldown--;
    }, 1000);

    // Cleanup before timeout fires
    cleanup();

    vi.advanceTimersByTime(1000);
    expect(cooldown).toBe(3); // Should NOT have decremented
  });
});
