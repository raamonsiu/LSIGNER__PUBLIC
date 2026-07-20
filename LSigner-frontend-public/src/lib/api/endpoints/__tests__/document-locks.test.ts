import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  getPrivateDocumentLocksApi,
  getPublicDocumentLocksApi,
  resolvePrivateDocumentLockApi,
  resolvePublicDocumentLockApi,
} from '../document-locks';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPrivateDocumentLocksApi', () => {
  it('GET /documents/received/:id/locks', async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    await getPrivateDocumentLocksApi('doc-001');

    expect(api.get).toHaveBeenCalledWith('/documents/received/doc-001/locks');
  });
});

describe('resolvePrivateDocumentLockApi', () => {
  it('POST /documents/:id/locks/:lockId/resolve', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await resolvePrivateDocumentLockApi('doc-001', 'lock-123', 'secret123');

    expect(api.post).toHaveBeenCalledWith(
      '/documents/doc-001/locks/lock-123/resolve',
      { password: 'secret123' },
    );
  });
});

describe('getPublicDocumentLocksApi', () => {
  it('GET /v1/public/documents/me/locks', async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    await getPublicDocumentLocksApi();

    expect(api.get).toHaveBeenCalledWith('/v1/public/documents/me/locks', {
      skipAuth: true,
    });
  });
});

describe('resolvePublicDocumentLockApi', () => {
  it('POST /v1/public/documents/me/locks/:lockId/resolve', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await resolvePublicDocumentLockApi('lock-001', 'secret123');

    expect(api.post).toHaveBeenCalledWith(
      '/v1/public/documents/me/locks/lock-001/resolve',
      { password: 'secret123' },
      { skipAuth: true },
    );
  });
});
