import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  getPublicDocumentMeApi,
  rejectPublicDocumentApi,
  revokePublicDocumentApi,
  signPublicDocumentApi,
} from '../public-documents';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPublicDocumentMeApi', () => {
  it('GET /v1/public/documents/me', async () => {
    vi.mocked(api.get).mockResolvedValue({ id: 'doc-001' });

    await getPublicDocumentMeApi();

    expect(api.get).toHaveBeenCalledWith('/v1/public/documents/me', {
      skipAuth: true,
    });
  });
});

describe('signPublicDocumentApi', () => {
  it('POST /v1/public/documents/me/sign', async () => {
    vi.mocked(api.post).mockResolvedValue({ status: 'SIGNED' });

    await signPublicDocumentApi({ verification_method: 'OTP' });

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/documents/me/sign',
      { verification_method: 'OTP' },
      { skipAuth: true },
    );
  });
});

describe('rejectPublicDocumentApi', () => {
  it('POST /v1/public/documents/me/reject', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await rejectPublicDocumentApi({
      verification_method: 'OTP',
      reason: 'Invalid content',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/documents/me/reject',
      { verification_method: 'OTP', reason: 'Invalid content' },
      { skipAuth: true },
    );
  });
});

describe('revokePublicDocumentApi', () => {
  it('POST /v1/public/documents/me/revoke', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await revokePublicDocumentApi({ verification_method: 'OTP' });

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/documents/me/revoke',
      { verification_method: 'OTP' },
      { skipAuth: true },
    );
  });
});
