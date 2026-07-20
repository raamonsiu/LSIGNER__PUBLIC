import { api } from '@/lib/api';
import type {
  DocumentActionType,
  OtpChallengeResponse,
  OtpChallengeResendResponse,
  OtpVerifyResponse,
} from './types';

export function createOtpChallengeApi(
  actionType: DocumentActionType,
  resourceType: string,
  resourceId: string,
): Promise<OtpChallengeResponse> {
  return api.post<OtpChallengeResponse>('/v1/otp/challenges', {
    actionType,
    resourceType,
    resourceId,
  });
}

export function resendOtpApi(
  challengeId: string,
): Promise<OtpChallengeResendResponse> {
  return api.post<OtpChallengeResendResponse>(
    `/v1/otp/challenges/${encodeURIComponent(challengeId)}/resend`,
    {},
  );
}

export function verifyOtpApi(
  challengeId: string,
  code: string,
): Promise<OtpVerifyResponse> {
  return api.post<OtpVerifyResponse>(
    `/v1/otp/challenges/${encodeURIComponent(challengeId)}/verify`,
    { code },
  );
}
