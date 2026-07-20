import { api } from '@/lib/api';
import type {
  DocumentActionType,
  OtpChallengeResponse,
  OtpChallengeResendResponse,
  OtpVerifyResponse,
} from './types';

export function createPublicOtpChallengeApi(
  actionType: DocumentActionType,
  resourceType: string,
  resourceId: string,
  reason?: string,
): Promise<OtpChallengeResponse> {
  return api.post<OtpChallengeResponse>(
    '/v1/public/otp/challenges',
    {
      actionType,
      resourceType,
      resourceId,
      reason,
    },
    { skipAuth: true },
  );
}

export function resendPublicOtpApi(
  challengeId: string,
): Promise<OtpChallengeResendResponse> {
  return api.post<OtpChallengeResendResponse>(
    `/v1/public/otp/challenges/${encodeURIComponent(challengeId)}/resend`,
    {},
    { skipAuth: true },
  );
}

export function verifyPublicOtpApi(
  challengeId: string,
  code: string,
): Promise<OtpVerifyResponse> {
  return api.post<OtpVerifyResponse>(
    `/v1/public/otp/challenges/${encodeURIComponent(challengeId)}/verify`,
    { code },
    { skipAuth: true },
  );
}
