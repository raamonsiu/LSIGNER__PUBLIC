import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOtpAction } from './useOtpAction';
import type {
  OtpChallengeResponse,
  OtpChallengeResendResponse,
  OtpVerifyResponse,
} from '@/lib/api/endpoints/types';

function makeChallenge(
  overrides?: Partial<OtpChallengeResponse>,
): OtpChallengeResponse {
  return {
    challengeId: 'challenge-1',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
    maskedDestination: 'a***@example.com',
    remainingAttempts: 5,
    remainingResends: 3,
    ...overrides,
  };
}

function makeResendResponse(
  overrides?: Partial<OtpChallengeResendResponse>,
): OtpChallengeResendResponse {
  return {
    challengeId: 'challenge-1',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
    remainingResends: 2,
    ...overrides,
  };
}

function makeVerifyResponse(
  overrides?: Partial<OtpVerifyResponse>,
): OtpVerifyResponse {
  return {
    verified: true,
    actionResult: {
      resourceType: 'DOCUMENT',
      resourceId: 'doc-1',
      newStatus: 'SIGNED',
    },
    ...overrides,
  };
}

describe('useOtpAction', () => {
  it('starts action and sets challenge with cooldown', async () => {
    const createChallenge = vi.fn().mockResolvedValue(makeChallenge());

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge,
        resendOtp: vi.fn(),
        verifyOtp: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startAction('SIGN', 'DOCUMENT', 'doc-1');
    });

    expect(result.current.currentChallenge?.challengeId).toBe('challenge-1');
    expect(result.current.currentChallenge?.remainingAttempts).toBe(5);
    expect(result.current.canResendOtp).toBe(false);
    expect(result.current.resendCooldown).toBeGreaterThan(0);
    expect(createChallenge).toHaveBeenCalledWith('SIGN', 'DOCUMENT', 'doc-1');
  });

  it('sets canResendOtp to true when cooldown is zero', async () => {
    const now = Date.now();
    const createChallenge = vi.fn().mockResolvedValue(
      makeChallenge({
        resendAvailableAt: new Date(now - 1000).toISOString(),
      }),
    );

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge,
        resendOtp: vi.fn(),
        verifyOtp: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startAction('SIGN', 'DOCUMENT', 'doc-1');
    });

    expect(result.current.canResendOtp).toBe(true);
    expect(result.current.resendCooldown).toBe(0);
  });

  it('resets state on closeFlow', async () => {
    const createChallenge = vi.fn().mockResolvedValue(makeChallenge());

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge,
        resendOtp: vi.fn(),
        verifyOtp: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startAction('SIGN', 'DOCUMENT', 'doc-1');
    });

    expect(result.current.currentChallenge).not.toBeNull();

    act(() => {
      result.current.closeFlow();
    });

    expect(result.current.currentChallenge).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.canResendOtp).toBe(true);
    expect(result.current.resendCooldown).toBe(0);
  });

  it('handles resend and updates challenge', async () => {
    const now = Date.now();
    const createChallenge = vi.fn().mockResolvedValue(
      makeChallenge({
        resendAvailableAt: new Date(now - 1000).toISOString(),
      }),
    );
    const resendOtp = vi.fn().mockResolvedValue(
      makeResendResponse({
        resendAvailableAt: new Date(now + 30_000).toISOString(),
      }),
    );

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge,
        resendOtp,
        verifyOtp: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startAction('SIGN', 'DOCUMENT', 'doc-1');
    });

    expect(result.current.canResendOtp).toBe(true);

    await act(async () => {
      await result.current.handleResend();
    });

    expect(resendOtp).toHaveBeenCalledWith('challenge-1');
    expect(result.current.currentChallenge?.remainingResends).toBe(2);
  });

  it('does not resend when canResendOtp is false', async () => {
    const createChallenge = vi.fn().mockResolvedValue(makeChallenge());
    const resendOtp = vi.fn();

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge,
        resendOtp,
        verifyOtp: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startAction('SIGN', 'DOCUMENT', 'doc-1');
    });

    expect(result.current.canResendOtp).toBe(false);
    expect(result.current.resendCooldown).toBeGreaterThan(0);

    await act(async () => {
      await result.current.handleResend();
    });

    expect(resendOtp).not.toHaveBeenCalled();
  });

  it('does not resend when there is no active challenge', async () => {
    const resendOtp = vi.fn();

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge: vi.fn(),
        resendOtp,
        verifyOtp: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleResend();
    });

    expect(resendOtp).not.toHaveBeenCalled();
  });

  it('handles verify and returns response', async () => {
    const createChallenge = vi.fn().mockResolvedValue(makeChallenge());
    const verifyOtp = vi.fn().mockResolvedValue(makeVerifyResponse());

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge,
        resendOtp: vi.fn(),
        verifyOtp,
      }),
    );

    await act(async () => {
      await result.current.startAction('SIGN', 'DOCUMENT', 'doc-1');
    });

    let response: OtpVerifyResponse | undefined;
    await act(async () => {
      response = await result.current.handleVerify('123456');
    });

    expect(verifyOtp).toHaveBeenCalledWith('challenge-1', '123456');
    expect(response?.verified).toBe(true);
    expect(response?.actionResult.newStatus).toBe('SIGNED');
  });

  it('sets isSubmitting during verify', async () => {
    const createChallenge = vi.fn().mockResolvedValue(makeChallenge());
    const verifyOtp = vi.fn().mockResolvedValue(makeVerifyResponse());

    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge,
        resendOtp: vi.fn(),
        verifyOtp,
      }),
    );

    await act(async () => {
      await result.current.startAction('SIGN', 'DOCUMENT', 'doc-1');
    });

    // Start verify in a microtask to check isSubmitting during execution
    let verifyPromise: Promise<OtpVerifyResponse>;
    act(() => {
      verifyPromise = result.current.handleVerify('123456');
    });

    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      await verifyPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('throws when verify is called without an active challenge', async () => {
    const { result } = renderHook(() =>
      useOtpAction({
        createChallenge: vi.fn(),
        resendOtp: vi.fn(),
        verifyOtp: vi.fn(),
      }),
    );

    await expect(result.current.handleVerify('123456')).rejects.toThrow(
      'No active challenge',
    );
  });
});
