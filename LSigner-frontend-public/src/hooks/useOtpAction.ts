'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DocumentActionType,
  OtpChallengeResendResponse,
  OtpChallengeResponse,
  OtpVerifyResponse,
} from '@/lib/api/endpoints/types';
import { ApiError } from '@/lib/api/core/errors';

interface UseOtpActionOptions {
  createChallenge: (
    action: DocumentActionType,
    resourceType: string,
    resourceId: string,
  ) => Promise<OtpChallengeResponse>;
  resendOtp: (challengeId: string) => Promise<OtpChallengeResendResponse>;
  verifyOtp: (challengeId: string, code: string) => Promise<OtpVerifyResponse>;
}

interface UseOtpActionReturn {
  currentChallenge: OtpChallengeResponse | null;
  isSubmitting: boolean;
  resendCooldown: number;
  canResendOtp: boolean;
  startAction: (
    action: DocumentActionType,
    resourceType: string,
    resourceId: string,
  ) => Promise<void>;
  handleResend: () => Promise<void>;
  handleVerify: (code: string) => Promise<OtpVerifyResponse>;
  closeFlow: () => void;
}

function getRemainingCooldownSeconds(availableAt: string | null): number {
  if (!availableAt) return 0;
  const availableTimestamp = Date.parse(availableAt);
  if (Number.isNaN(availableTimestamp)) return 0;
  return Math.max(Math.ceil((availableTimestamp - Date.now()) / 1000), 0);
}

/**
 * Shared hook for OTP challenge lifecycle management.
 *
 * Manages createChallenge, resend (with cooldown), verify, and cooldown timer.
 * Error messages and success handling are left to the consuming page.
 */
export function useOtpAction(options: UseOtpActionOptions): UseOtpActionReturn {
  const { createChallenge, resendOtp, verifyOtp } = options;

  const [currentChallenge, setCurrentChallenge] =
    useState<OtpChallengeResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const canResendOtp = resendCooldown <= 0;

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const countdownTimer = window.setTimeout(() => {
      setResendCooldown((previousCooldown) =>
        previousCooldown > 0 ? previousCooldown - 1 : 0,
      );
    }, 1000);

    return () => {
      window.clearTimeout(countdownTimer);
    };
  }, [resendCooldown]);

  const startAction = useCallback(
    async (
      action: DocumentActionType,
      resourceType: string,
      resourceId: string,
    ) => {
      const challenge = await createChallenge(action, resourceType, resourceId);
      setCurrentChallenge(challenge);
      const initialCooldownSeconds = getRemainingCooldownSeconds(
        challenge.resendAvailableAt,
      );
      setResendCooldown(initialCooldownSeconds);
    },
    [createChallenge],
  );

  const handleResend = useCallback(async () => {
    if (!currentChallenge || !canResendOtp) return;
    try {
      const response = await resendOtp(currentChallenge.challengeId);
      setCurrentChallenge((previousChallenge) =>
        previousChallenge
          ? {
              ...previousChallenge,
              expiresAt: response.expiresAt,
              resendAvailableAt: response.resendAvailableAt,
              remainingResends: response.remainingResends,
            }
          : previousChallenge,
      );
      const nextCooldown = getRemainingCooldownSeconds(
        response.resendAvailableAt,
      );
      setResendCooldown(nextCooldown);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 409) {
        const waitSecondsMatch = error.message.match(/(\d+)\s*seconds/i);
        const waitSeconds = waitSecondsMatch ? Number(waitSecondsMatch[1]) : 45;
        setResendCooldown(waitSeconds);
      }
      throw error;
    }
  }, [currentChallenge, canResendOtp, resendOtp]);

  const handleVerify = useCallback(
    async (code: string): Promise<OtpVerifyResponse> => {
      if (!currentChallenge) {
        throw new Error('No active challenge');
      }
      setIsSubmitting(true);
      try {
        return await verifyOtp(currentChallenge.challengeId, code);
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentChallenge, verifyOtp],
  );

  const closeFlow = useCallback(() => {
    setCurrentChallenge(null);
    setResendCooldown(0);
    setIsSubmitting(false);
  }, []);

  return {
    currentChallenge,
    isSubmitting,
    resendCooldown,
    canResendOtp,
    startAction,
    handleResend,
    handleVerify,
    closeFlow,
  };
}
