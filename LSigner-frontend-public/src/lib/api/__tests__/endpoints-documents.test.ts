/**
 * Unit tests for fetchDocumentDownloadBlobUrl in documents.ts.
 *
 * We mock @/lib/api so getToken() and triggerRefresh() can be controlled,
 * and stub globalThis.fetch for HTTP interactions.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockGetToken, mockTriggerRefresh } = vi.hoisted(() => ({
  mockGetToken: vi.fn<() => Promise<string | null>>(),
  mockTriggerRefresh: vi.fn<() => Promise<boolean>>(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  },
  API_BASE_URL: 'http://localhost:3000',
  getToken: mockGetToken,
  triggerRefresh: mockTriggerRefresh,
}));

// Dynamic import so vi.mock hoists before module init
const { fetchDocumentDownloadBlobUrl } =
  await import('@/lib/api/endpoints/documents');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBlob(content = 'binary-data'): Blob {
  return new Blob([content]);
}

/**
 * Returns a plain object matching the Response shape consumed by
 * fetchDocumentDownloadBlobUrl ({ ok, status, blob() }).
 *
 * We avoid `new Response(blob)` because Node's undici Response constructor
 * calls .stream() on the body, which Blob does not support in this env.
 */
function okBlobResponse(blob: Blob): Partial<Response> {
  return {
    ok: true,
    status: 200,
    blob: () => Promise.resolve(blob),
  };
}

function unauthorisedResponse(): Partial<Response> {
  return {
    ok: false,
    status: 401,
    blob: () => Promise.resolve(new Blob()),
  };
}

function serverErrorResponse(): Partial<Response> {
  return {
    ok: false,
    status: 500,
    blob: () => Promise.resolve(new Blob()),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('fetchDocumentDownloadBlobUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('happy path: returns Blob on 200', async () => {
    mockGetToken.mockResolvedValue('valid-token');
    const blob = makeBlob();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okBlobResponse(blob)));

    const result = await fetchDocumentDownloadBlobUrl('doc-123');

    expect(result).toBeInstanceOf(Blob);
    expect(mockGetToken).toHaveBeenCalledOnce();
  });

  it('throws DOWNLOAD_FAILED_401 when getToken returns null (no session)', async () => {
    mockGetToken.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());

    await expect(fetchDocumentDownloadBlobUrl('doc-123')).rejects.toThrow(
      'DOWNLOAD_FAILED_401',
    );
    expect(mockGetToken).toHaveBeenCalledOnce();
    // No fetch attempted
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('refresh-and-retry: on 401, triggers refresh, retries with fresh token, returns Blob', async () => {
    mockGetToken
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token');
    mockTriggerRefresh.mockResolvedValue(true);

    let callCount = 0;
    const blob = makeBlob();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(unauthorisedResponse());
        return Promise.resolve(okBlobResponse(blob));
      }),
    );

    const result = await fetchDocumentDownloadBlobUrl('doc-123');

    expect(result).toBeInstanceOf(Blob);
    expect(mockTriggerRefresh).toHaveBeenCalledOnce();
    expect(mockGetToken).toHaveBeenCalledTimes(2);
    expect(callCount).toBe(2);
  });

  it('throws DOWNLOAD_FAILED_401 when refresh fails', async () => {
    mockGetToken.mockResolvedValue('expired-token');
    mockTriggerRefresh.mockResolvedValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauthorisedResponse()));

    await expect(fetchDocumentDownloadBlobUrl('doc-123')).rejects.toThrow(
      'DOWNLOAD_FAILED_401',
    );
    expect(mockTriggerRefresh).toHaveBeenCalledOnce();
  });

  it('throws DOWNLOAD_FAILED on network error (fetch rejects)', async () => {
    mockGetToken.mockResolvedValue('valid-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    );

    await expect(fetchDocumentDownloadBlobUrl('doc-123')).rejects.toThrow(
      'DOWNLOAD_FAILED',
    );
  });

  it('throws DOWNLOAD_FAILED on non-200 non-401 response', async () => {
    mockGetToken.mockResolvedValue('valid-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(serverErrorResponse()));

    await expect(fetchDocumentDownloadBlobUrl('doc-123')).rejects.toThrow(
      'DOWNLOAD_FAILED',
    );
  });
});
