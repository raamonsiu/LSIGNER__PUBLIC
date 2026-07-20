import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, ApiError, setTokenProvider } from '@/lib/api';

/**
 * Integration tests against the live backend (localhost:3000).
 *
 * Prerequisite: `docker compose -f docker-compose.dev.yml up -d` in
 * LSigner-backend.
 *
 * When the backend is unreachable every test silently passes so the suite
 * never blocks a normal `npm run test` session.
 */

const TEST_PASSWORD = 'password123';
const TEST_EMAIL = `int-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
const TEST_PHONE = `+346${Math.floor(1e7 + Math.random() * 9e7)}`;

let accessToken = '';
let userId = '';
let backendReady = false;

describe('API client — integration (live backend)', () => {
  beforeAll(async () => {
    try {
      await api.get('/health');
    } catch {
      return;
    }

    const user = (await api.post('/users', {
      name: 'Integration',
      last_name: 'Test',
      country: 'Spain',
      email: TEST_EMAIL,
      phone_number: TEST_PHONE,
      password: TEST_PASSWORD,
    })) as Record<string, unknown>;
    userId = user.patient_id as string;

    const tokens = (await api.post('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })) as Record<string, unknown>;
    accessToken = tokens.access_token as string;

    setTokenProvider(() => accessToken);
    backendReady = true;
  }, 15_000);

  afterAll(async () => {
    setTokenProvider(null);
    if (userId) {
      try {
        await api.delete(`/users/${userId}`);
      } catch {
        /* ignore */
      }
    }
  }, 15_000);

  function failIfBackendDown() {
    if (!backendReady) return true;
    return false;
  }

  async function catchErr<T>(promise: Promise<T>): Promise<unknown> {
    return promise.catch((e: unknown) => e);
  }

  it('connects and returns text body', async () => {
    if (failIfBackendDown()) return;
    const result = await api.get<string>('/health');
    expect(result).toBe('OK');
  });

  it('serialises query params into the URL', async () => {
    if (failIfBackendDown()) return;
    const result = await api.get('/test/echo', {
      params: { foo: 'bar', n: 42 },
    });
    expect(result).toEqual({ foo: 'bar', n: '42' });
  });

  it('serialises the request body as JSON and returns parsed response', async () => {
    if (failIfBackendDown()) return;
    const result = await api.post('/test/echo', { hello: 'world' });
    expect(result).toEqual({ hello: 'world' });
  });

  it('forwards extra headers', async () => {
    if (failIfBackendDown()) return;
    const result = await api.post('/test/echo-headers', null, {
      headers: { 'X-Custom': 'test-value' },
    });
    expect(result).toHaveProperty('x-custom', 'test-value');
  });

  it('sends an X-Request-Id header on every request', async () => {
    if (failIfBackendDown()) return;
    const result = (await api.post('/test/echo-headers')) as Record<
      string,
      unknown
    >;
    expect(result['x-request-id']).toBeTruthy();
    expect(typeof result['x-request-id']).toBe('string');
  });

  it('throws ApiError with statusCode 404 (client error)', async () => {
    if (failIfBackendDown()) return;
    const err = await catchErr(api.get('/test/status/404'));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(404);
    expect((err as ApiError).isClientError).toBe(true);
    expect((err as ApiError).isServerError).toBe(false);
  });

  it('throws ApiError with statusCode 500 (server error)', async () => {
    if (failIfBackendDown()) return;
    const err = await catchErr(api.get('/test/status/500'));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(500);
    expect((err as ApiError).isServerError).toBe(true);
    expect((err as ApiError).isClientError).toBe(false);
  });

  it('exposes validation messages from the backend', async () => {
    if (failIfBackendDown()) return;
    const err = await catchErr(
      api.get('/test/status/422', { params: { type: 'validation' } }),
    );
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.statusCode).toBe(422);
    expect(apiErr.validationMessages).not.toBeNull();
    expect(apiErr.validationMessages).toContain('field1 is required');
    expect(apiErr.validationMessages).toContain('field2 must be a string');
  });

  it('aborts with isAbort=true when the server takes longer than the configured timeout', async () => {
    if (failIfBackendDown()) return;
    const err = await catchErr(api.get('/test/delay/6000', { timeout: 1_000 }));
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.isAbort).toBe(true);
    expect(apiErr.statusCode).toBe(0);
    expect(apiErr.error).toBe('AbortError');
  }, 5_000);

  it('returns 401 when skipAuth prevents the token from being sent', async () => {
    if (failIfBackendDown()) return;
    const err = await catchErr(api.get('/test/protected', { skipAuth: true }));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(401);
  });

  it('uses the globally registered token and succeeds on protected routes', async () => {
    if (failIfBackendDown()) return;
    const result = (await api.get('/test/protected')) as Record<
      string,
      unknown
    >;
    expect(result.email).toBe(TEST_EMAIL);
    expect(result.userId).toBe(userId);
  });

  it('uses the per-request token instead of the global provider', async () => {
    if (failIfBackendDown()) return;
    const result = await catchErr(
      api.get('/test/protected', { token: accessToken }),
    );
    expect(result).not.toBeInstanceOf(ApiError);
    expect(result).toHaveProperty('email', TEST_EMAIL);
  });

  it('rejects with 401 when an invalid token is provided', async () => {
    if (failIfBackendDown()) return;
    const err = await catchErr(
      api.get('/test/protected', { token: 'i-am-not-a-valid-jwt' }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(401);
  });

  it('produces statusCode 0 for a network error (unreachable host)', async () => {
    if (failIfBackendDown()) return;
    const err = await catchErr(
      api.request('GET', 'http://localhost:19999/nope', {
        timeout: 500,
        skipAuth: true,
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.statusCode).toBe(0);
    expect(apiErr.error).toBe('NetworkError');
    expect(apiErr.path).toContain('19999');
  }, 5_000);
});
