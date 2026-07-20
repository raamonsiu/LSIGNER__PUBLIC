/**
 * Unit tests for the API client.
 *
 * We stub `globalThis.fetch` with `vi.fn` to verify that the client:
 *  - serialises bodies and sets JSON headers by default;
 *  - injects the bearer token via `setTokenProvider`;
 *  - respects a per-request `timeout` / external `AbortSignal`;
 *  - parses JSON success and 204 No Content responses;
 *  - throws a typed `ApiError` mirroring the backend payload on non-2xx;
 *  - falls back to a transport-layer `ApiError` on network failure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setTokenProvider } from '@/lib/api';
import type { ApiErrorResponse } from '@/lib/api';
// Import setters directly from source until they are re-exported from the barrel
import {
  getToken,
  setOnUnauthorized,
  setRefreshSession,
  triggerRefresh,
} from '@/lib/api/core/client';

const BACKEND_PAYLOAD: ApiErrorResponse = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'No authentication token provided',
  path: '/auth/login',
  timestamp: '2026-05-28T10:00:00.000Z',
  requestId: 'req-abc',
};

function mockFetch(
  responder: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>,
) {
  const spy = vi.fn(responder);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

/**
 * Build a fetch stub that rejects with an `AbortError` as soon as the
 * request's signal aborts. If the signal is already aborted when the
 * request fires, the rejection happens synchronously inside the executor.
 */
function abortableNeverResolvingFetch(): { spy: ReturnType<typeof mockFetch> } {
  const spy = mockFetch(
    async (_input, init) =>
      new Promise<never>((_, reject) => {
        if (init?.signal?.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      }),
  );
  return { spy };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setTokenProvider(null);
  setOnUnauthorized(null);
  setRefreshSession(null);
});

describe('api.get', () => {
  it('prefixes the path with API_BASE_URL and sends JSON headers', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({ ok: true }));

    const data = await api.get<{ ok: boolean }>('/example');

    expect(data).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/example$/);
    const headers = new Headers(init?.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-Request-Id')).toBeTruthy();
  });

  it('appends query string params', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse([]));

    await api.get('/items', { params: { page: 2, q: 'hello', omit: null } });

    const [url] = fetchSpy.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('q')).toBe('hello');
    expect(parsed.searchParams.has('omit')).toBe(false);
  });
});

describe('api.post', () => {
  it('serialises the body and sets Content-Type', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({ id: 1 }));

    const data = await api.post<{ id: number }>('/users', { name: 'Ada' });

    expect(data).toEqual({ id: 1 });
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ name: 'Ada' }));
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});

describe('204 No Content', () => {
  it('resolves with undefined', async () => {
    mockFetch(async () => emptyResponse(204));

    const result = await api.delete('/sessions/1');

    expect(result).toBeUndefined();
  });
});

describe('auth token injection', () => {
  it('attaches Authorization header from the registered token provider', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({}));
    setTokenProvider(() => 'jwt.token.value');

    await api.get('/me');

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer jwt.token.value');
  });

  it('skips auth when skipAuth is true', async () => {
    setTokenProvider(() => 'should.not.be.used');
    const fetchSpy = mockFetch(async () => jsonResponse({}));

    await api.get('/health', { skipAuth: true });

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('prefers a per-request token over the provider', async () => {
    setTokenProvider(() => 'provider.token');
    const fetchSpy = mockFetch(async () => jsonResponse({}));

    await api.get('/me', { token: 'explicit.token' });

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer explicit.token');
  });
});

describe('error handling', () => {
  it('throws an ApiError that mirrors the backend payload', async () => {
    mockFetch(async () => jsonResponse(BACKEND_PAYLOAD, { status: 401 }));

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 401,
      error: 'Unauthorized',
      message: 'No authentication token provided',
      path: '/auth/login',
      requestId: 'req-abc',
      isClientError: true,
      isServerError: false,
    });
  });

  it('exposes validation messages for 400 responses', async () => {
    mockFetch(async () =>
      jsonResponse(
        {
          statusCode: 400,
          error: 'Bad Request',
          message: ['email must be an email', 'password should not be empty'],
          path: '/users',
          timestamp: '2026-05-28T10:00:00.000Z',
        },
        { status: 400 },
      ),
    );

    try {
      await api.post('/users', {});
    } catch (cause) {
      const err = cause as ApiError;
      expect(err.validationMessages).toEqual([
        'email must be an email',
        'password should not be empty',
      ]);
    }
  });

  it('backfills the request path when the backend omits it', async () => {
    mockFetch(
      async () =>
        new Response('not json', {
          status: 500,
          headers: { 'content-type': 'text/plain' },
        }),
    );

    try {
      await api.get('/oops');
    } catch (cause) {
      const err = cause as ApiError;
      expect(err.statusCode).toBe(500);
      expect(err.path).toBe('GET /oops');
    }
  });

  it('wraps network errors in an ApiError with status 0', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    try {
      await api.get('/oops');
    } catch (cause) {
      const err = cause as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(0);
      expect(err.error).toBe('NetworkError');
      expect(err.message).toContain('Failed to fetch');
      expect(err.path).toBe('GET /oops');
    }
  });
});

describe('timeouts and aborts', () => {
  it('aborts the request after the configured timeout', async () => {
    vi.useFakeTimers();
    try {
      let abortSignal: AbortSignal | undefined;
      mockFetch(async (_input, init) => {
        abortSignal = init?.signal ?? undefined;
        return new Promise<never>((_, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      });

      const caught = api.get('/slow', { timeout: 50 }).catch((e: unknown) => e);

      await vi.advanceTimersByTimeAsync(60);

      const err = await caught;
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.isAbort).toBe(true);
      expect(apiErr.message).toMatch(/timed out after 50ms/);
      expect(abortSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('respects an external AbortSignal', async () => {
    const controller = new AbortController();
    abortableNeverResolvingFetch();

    const caught = api
      .get('/whatever', { signal: controller.signal })
      .catch((e: unknown) => e);

    controller.abort();

    const err = await caught;
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.isAbort).toBe(true);
    expect(apiErr.message).toMatch(/cancelled/);
  });
});

describe('extra headers', () => {
  it('merges caller-provided headers over the defaults', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({}));

    await api.get('/items', {
      headers: { 'X-Trace': 'abc', Accept: 'text/plain' },
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Trace')).toBe('abc');
    expect(headers.get('Accept')).toBe('text/plain');
  });
});

describe('401 interceptor — setters', () => {
  it('setOnUnauthorized registers a callback and null clears it', () => {
    const cb = vi.fn();
    setOnUnauthorized(cb);
    // Verify setter does not throw; actual behavior is tested in integration below
    setOnUnauthorized(null);
  });

  it('setRefreshSession registers a callback and null clears it', () => {
    const cb = vi.fn(async () => true);
    setRefreshSession(cb);
    setRefreshSession(null);
  });
});

describe('401 interceptor — refresh and retry', () => {
  it('retries the request with a new token on 401 when refresh succeeds', async () => {
    setTokenProvider(() => 'expired.token');

    // Register a refresh that returns true (success)
    setRefreshSession(async () => {
      // Simulate token provider being updated during refresh
      setTokenProvider(() => 'fresh.token');
      return true;
    });

    // First call returns 401, second returns 200
    let callCount = 0;
    const fetchSpy = mockFetch(async () => {
      callCount++;
      if (callCount === 1) {
        return jsonResponse(
          { statusCode: 401, error: 'Unauthorized', message: 'Token expired' },
          { status: 401 },
        );
      }
      return jsonResponse({ id: 42 });
    });

    const result = await api.get<{ id: number }>('/me');

    expect(callCount).toBe(2);
    expect(result).toEqual({ id: 42 });

    // Verify the retry used the fresh token
    const [, retryInit] = fetchSpy.mock.calls[1]!;
    const retryHeaders = new Headers(retryInit?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer fresh.token');
  });

  it('calls onUnauthorized when refresh fails', async () => {
    setTokenProvider(() => 'expired.token');
    const onUnauthorizedSpy = vi.fn();
    setOnUnauthorized(onUnauthorizedSpy);

    setRefreshSession(async () => false);

    mockFetch(async () =>
      jsonResponse(
        { statusCode: 401, error: 'Unauthorized', message: 'Token expired' },
        { status: 401 },
      ),
    );

    await expect(api.get('/me')).rejects.toMatchObject({ statusCode: 401 });
    expect(onUnauthorizedSpy).toHaveBeenCalledOnce();
  });

  it('calls onUnauthorized per-request on refresh failure with concurrent 401s', async () => {
    setTokenProvider(() => 'expired.token');
    const onUnauthorizedSpy = vi.fn();
    setOnUnauthorized(onUnauthorizedSpy);

    let refreshCalls = 0;
    setRefreshSession(async () => {
      refreshCalls++;
      // Only the first one should run; the lock prevents others
      return false;
    });

    // All three calls return 401
    mockFetch(async () =>
      jsonResponse(
        { statusCode: 401, error: 'Unauthorized', message: 'Token expired' },
        { status: 401 },
      ),
    );

    const results = await Promise.allSettled([
      api.get('/a'),
      api.get('/b'),
      api.get('/c'),
    ]);

    // All three should fail with 401
    for (const r of results) {
      expect(r.status).toBe('rejected');
    }

    // Exactly one refresh attempt
    expect(refreshCalls).toBe(1);
    // onUnauthorized fires per-request (no global dedup flag)
    expect(onUnauthorizedSpy).toHaveBeenCalledTimes(3);
  });

  it('retries concurrently — exactly one refresh, all requests succeed', async () => {
    setTokenProvider(() => 'expired.token');

    let refreshCalls = 0;
    setRefreshSession(async () => {
      refreshCalls++;
      setTokenProvider(() => 'fresh.token');
      return true;
    });

    // First three calls return 401, subsequent calls return 200
    let fetchCalls = 0;
    const fetchSpy = mockFetch(async () => {
      fetchCalls++;
      if (fetchCalls <= 3) {
        return jsonResponse(
          { statusCode: 401, error: 'Unauthorized', message: 'Token expired' },
          { status: 401 },
        );
      }
      return jsonResponse({ ok: true });
    });

    const results = await Promise.all([
      api.get('/a'),
      api.get('/b'),
      api.get('/c'),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(fetchCalls).toBe(6); // 3 initial + 3 retries = 6
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it('does NOT trigger refresh for skipAuth requests', async () => {
    const refreshSpy = vi.fn(async () => true);
    setRefreshSession(refreshSpy);
    const onUnauthorizedSpy = vi.fn();
    setOnUnauthorized(onUnauthorizedSpy);

    mockFetch(async () =>
      jsonResponse(
        { statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' },
        { status: 401 },
      ),
    );

    await expect(api.get('/health', { skipAuth: true })).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(onUnauthorizedSpy).not.toHaveBeenCalled();
  });

  it('does NOT trigger refresh when the request carries an explicit token', async () => {
    const refreshSpy = vi.fn(async () => true);
    setRefreshSession(refreshSpy);
    const onUnauthorizedSpy = vi.fn();
    setOnUnauthorized(onUnauthorizedSpy);

    mockFetch(async () =>
      jsonResponse(
        { statusCode: 401, error: 'Unauthorized', message: 'Bad token' },
        { status: 401 },
      ),
    );

    await expect(
      api.get('/me', { token: 'explicit.token' }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(onUnauthorizedSpy).not.toHaveBeenCalled();
  });

  it('passes through non-401 errors without calling interceptor', async () => {
    const refreshSpy = vi.fn(async () => true);
    setRefreshSession(refreshSpy);
    const onUnauthorizedSpy = vi.fn();
    setOnUnauthorized(onUnauthorizedSpy);

    mockFetch(async () =>
      jsonResponse(
        { statusCode: 500, error: 'Internal Server Error', message: 'Oops' },
        { status: 500 },
      ),
    );

    await expect(api.get('/oops')).rejects.toMatchObject({ statusCode: 500 });
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(onUnauthorizedSpy).not.toHaveBeenCalled();
  });
});

describe('getToken', () => {
  it('returns the provider token when a token provider is registered', async () => {
    setTokenProvider(() => 'my-secret-token');
    const token = await getToken();
    expect(token).toBe('my-secret-token');
  });

  it('returns null when no token provider is registered', async () => {
    const token = await getToken();
    expect(token).toBeNull();
  });
});

describe('triggerRefresh', () => {
  it('returns true when refreshSession succeeds', async () => {
    setRefreshSession(async () => true);
    const result = await triggerRefresh();
    expect(result).toBe(true);
  });

  it('returns false when no refreshSession is registered', async () => {
    const result = await triggerRefresh();
    expect(result).toBe(false);
  });
});
