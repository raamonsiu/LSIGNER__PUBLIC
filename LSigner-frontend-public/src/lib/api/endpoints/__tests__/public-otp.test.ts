import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  createPublicOtpChallengeApi,
  resendPublicOtpApi,
  verifyPublicOtpApi,
} from '../public-otp';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPublicOtpChallengeApi', () => {
  it('POST /v1/public/otp/challenges', async () => {
    vi.mocked(api.post).mockResolvedValue({ challengeId: 'challenge-001' });

    await createPublicOtpChallengeApi('SIGN', 'DOCUMENT', 'doc-001');

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/otp/challenges',
      {
        actionType: 'SIGN',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-001',
        reason: undefined,
      },
      { skipAuth: true },
    );
  });
});

describe('resendPublicOtpApi', () => {
  it('POST /v1/public/otp/challenges/:id/resend', async () => {
    vi.mocked(api.post).mockResolvedValue({ challengeId: 'challenge-001' });

    await resendPublicOtpApi('challenge 001');

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/otp/challenges/challenge%20001/resend',
      {},
      { skipAuth: true },
    );
  });
});

describe('verifyPublicOtpApi', () => {
  it('POST /v1/public/otp/challenges/:id/verify', async () => {
    vi.mocked(api.post).mockResolvedValue({ verified: true });

    await verifyPublicOtpApi('challenge-001', '123456');

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/otp/challenges/challenge-001/verify',
      { code: '123456' },
      { skipAuth: true },
    );
  });
});
