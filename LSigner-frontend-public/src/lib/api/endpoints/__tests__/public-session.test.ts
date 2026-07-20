import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  bootstrapPublicSessionApi,
  logoutPublicSessionApi,
} from '../public-session';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bootstrapPublicSessionApi', () => {
  it('POST /v1/public/session/bootstrap', async () => {
    vi.mocked(api.post).mockResolvedValue({
      status: 'ANON_ALLOWED',
      documentId: 'doc-001',
    });

    await bootstrapPublicSessionApi('public-link-001');

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/session/bootstrap',
      { publicLinkId: 'public-link-001' },
      { skipAuth: true },
    );
  });
});

describe('logoutPublicSessionApi', () => {
  it('POST /v1/public/session/logout', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await logoutPublicSessionApi();

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/session/logout',
      {},
      { skipAuth: true },
    );
  });
});
