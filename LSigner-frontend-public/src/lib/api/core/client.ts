/**
 * Lightweight fetch-based HTTP client used by both the browser and
 * Route Handlers (BFF).
 *
 * Responsibilities:
 *  - Prefix all requests with `API_BASE_URL`.
 *  - Inject `Content-Type` / `Accept: application/json` by default.
 *  - Attach a `Authorization: Bearer <token>` header when a token is available.
 *  - Attach an `X-Request-Id` header for log correlation.
 *  - Enforce a per-request timeout via `AbortController` and propagate
 *    external `AbortSignal`s from React 19 / route handlers.
 *  - Decode JSON responses (and handle 204/empty bodies).
 *  - Throw a typed {@link ApiError} for any non-2xx response, transport
 *    failure, or timeout.
 *
 * No third-party HTTP library is used : the goal is to stay minimal and
 * tree-shakable.
 */

import { API_BASE_URL, API_DEFAULT_TIMEOUT_MS } from './config';
import { ApiError, type TokenProvider } from './errors';
import type { RequestConfig } from './types';

// === State ====================================================================

/** Token provider used by the client when none is passed per-request. */
let tokenProvider: TokenProvider | null = null;

/** Callback invoked when a 401 cannot be recovered via refresh. */
let onUnauthorized: (() => void) | null = null;

/** Callback invoked to attempt a silent token refresh. Returns true on success. */
let refreshSession: (() => Promise<boolean>) | null = null;

/** Promise lock : ensures only one refresh runs at a time across concurrent 401s. */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Register a function that returns the current bearer token, or `null`.
 * The AuthContext typically calls this on mount and on every token change.
 */
export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

/**
 * Register a callback that is invoked when a 401 response cannot be recovered
 * via a silent token refresh. Typically used to clear the session and redirect
 * to the login page.
 */
export function setOnUnauthorized(cb: (() => void) | null): void {
  onUnauthorized = cb;
}

/**
 * Register a callback that attempts to refresh the access token using the
 * stored refresh token. Must return `true` if the refresh succeeded (so the
 * original request can be retried) or `false` if the refresh failed.
 */
export function setRefreshSession(cb: (() => Promise<boolean>) | null): void {
  refreshSession = cb;
}

/**
 * Returns the current bearer token from the registered provider, or null.
 * Use this when you need the token outside the api client's request flow
 * (e.g. raw fetch for binary blobs).
 */
export async function getToken(): Promise<string | null> {
  if (!tokenProvider) return null;
  return (await tokenProvider()) ?? null;
}

/**
 * Triggers a token refresh via the registered refresh handler, respecting
 * the existing refresh lock. Returns true if the refresh succeeded.
 * Callers should re-read the token via {@link getToken} after a successful
 * refresh and retry their request.
 */
export async function triggerRefresh(): Promise<boolean> {
  if (!refreshSession) return false;
  return withRefreshLock(refreshSession);
}

// === Refresh lock =============================================================

/**
 * Ensures only one refresh runs at a time. Concurrent callers await
 * the same promise rather than starting duplicate refresh requests.
 */
async function withRefreshLock(
  refreshFn: () => Promise<boolean>,
): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshFn().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// === Public surface ===========================================================

export interface ApiClient {
  get<T = unknown>(path: string, config?: RequestConfig): Promise<T>;
  post<T = unknown>(
    path: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<T>;
  put<T = unknown>(
    path: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<T>;
  patch<T = unknown>(
    path: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<T>;
  delete<T = unknown>(path: string, config?: RequestConfig): Promise<T>;
  request<T = unknown>(
    method: HttpMethod,
    path: string,
    config?: RequestConfig,
  ): Promise<T>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Performs a JSON request and returns the decoded body.
 * Use the per-method shortcuts (`api.get`, `api.post`, …) in app code.
 */
export async function apiRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  config: RequestConfig & { body?: unknown } = {},
): Promise<T> {
  const url = buildUrl(path, config.params);
  const headers = await buildHeaders(config);
  const { signal, abort: abortSignal } = buildAbortSignal(config);
  // Serialise the body once so it can be reused in a retry
  // (FormData can only be consumed once).
  const serialized = serializeBody(config.body, config.raw);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: serialized,
      signal,
      credentials: 'include',
    });
    return await parseResponse<T>(response, method, path);
  } catch (error) {
    // Only intercept ApiErrors with status 401
    if (error instanceof ApiError && error.statusCode === 401) {
      const canRefresh =
        refreshSession && !config.skipAuth && config.token === undefined;

      if (canRefresh) {
        // Safe: canRefresh guarantees refreshSession is non-null
        const refreshed = await withRefreshLock(refreshSession!);

        if (refreshed) {
          // Abort old timeout so it doesn't fire during the retry
          abortSignal();
          // Retry with fresh headers (token provider was updated during refresh)
          // and a fresh AbortController with a new timeout
          const { signal: retrySignal } = buildAbortSignal(config);
          try {
            const retryHeaders = await buildHeaders(config);
            const retryResponse = await fetch(url, {
              method,
              headers: retryHeaders,
              body: serialized,
              signal: retrySignal,
              credentials: 'include',
            });
            return parseResponse<T>(retryResponse, method, path);
          } catch (retryError) {
            if (
              retryError instanceof ApiError &&
              retryError.statusCode === 401
            ) {
              onUnauthorized?.();
            }
            throw retryError;
          }
        }
      }

      // Only trigger onUnauthorized for genuine session expiry.
      // skipAuth and explicit-token requests are auth-agnostic :
      // their 401s mean bad credentials, not expired sessions.
      if (!config.skipAuth && config.token === undefined) {
        onUnauthorized?.();
      }
      throw error;
    }

    // Wrap transport errors (network failure, abort) in ApiError
    if (!(error instanceof ApiError)) {
      throw toTransportError(error, method, path, config);
    }
    throw error;
  }
}

const api: ApiClient = {
  get: <T>(path: string, config?: RequestConfig) =>
    apiRequest<T>('GET', path, config),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    apiRequest<T>('POST', path, { ...config, body }),
  put: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    apiRequest<T>('PUT', path, { ...config, body }),
  patch: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    apiRequest<T>('PATCH', path, { ...config, body }),
  delete: <T>(path: string, config?: RequestConfig) =>
    apiRequest<T>('DELETE', path, config),
  request: <T>(method: HttpMethod, path: string, config?: RequestConfig) =>
    apiRequest<T>(method, path, config),
};

// === URL building =============================================================

function buildUrl(path: string, params?: RequestConfig['params']): string {
  const url = new URL(
    path.startsWith('http')
      ? path
      : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
  );

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

// === Headers ==================================================================

async function buildHeaders(config: RequestConfig): Promise<Headers> {
  const headers = new Headers();

  if (!config.raw) {
    headers.set('Accept', 'application/json');
    if (config.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
  }

  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      headers.set(key, value);
    }
  }

  const token = await resolveToken(config);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Correlation id : always present so the backend's request log can be
  // cross-referenced with the originating client call.
  headers.set('X-Request-Id', generateRequestId());

  return headers;
}

async function resolveToken(config: RequestConfig): Promise<string | null> {
  if (config.skipAuth) return null;
  if (config.token !== undefined) return config.token;
  if (!tokenProvider) return null;
  return (await tokenProvider()) ?? null;
}

// === Abort / timeout ==========================================================

function buildAbortSignal(config: RequestConfig): {
  signal: AbortSignal;
  abort: () => void;
} {
  const timeoutMs = config.timeout ?? API_DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (config.signal) {
    if (config.signal.aborted) {
      controller.abort();
    } else {
      config.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }
  }

  controller.signal.addEventListener('abort', () => clearTimeout(timer), {
    once: true,
  });

  return { signal: controller.signal, abort: () => controller.abort() };
}

// === Body serialisation =======================================================

function serializeBody(body: unknown, raw?: boolean): BodyInit | null {
  if (body === undefined || body === null) return null;
  if (raw) return body as BodyInit;
  return JSON.stringify(body);
}

// === Response parsing =========================================================

async function parseResponse<T>(
  response: Response,
  method: HttpMethod,
  path: string,
): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson
    ? await safeJson(response)
    : await response.text();

  if (response.ok) {
    return body as T;
  }

  const error = ApiError.fromResponse(
    body,
    response.status,
    `Request failed with status ${response.status}`,
  );
  if (!error.path) {
    error.setPath(`${method} ${path}`);
  }
  throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// === Error mapping ============================================================

function toTransportError(
  cause: unknown,
  method: HttpMethod,
  path: string,
  config: RequestConfig,
): ApiError {
  const isAbort =
    cause instanceof DOMException
      ? cause.name === 'AbortError'
      : cause instanceof Error && cause.name === 'AbortError';

  return new ApiError({
    statusCode: 0,
    error: isAbort ? 'AbortError' : 'NetworkError',
    message: isAbort
      ? abortMessage(config)
      : cause instanceof Error
        ? cause.message
        : 'Network request failed',
    path: `${method} ${path}`,
    isAbort,
  });
}

function abortMessage(config: RequestConfig): string {
  if (config.signal?.aborted) {
    return 'Request was cancelled';
  }
  const ms = config.timeout ?? API_DEFAULT_TIMEOUT_MS;
  return `Request timed out after ${ms}ms`;
}

// === Request id ===============================================================

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// === Re-exports ===============================================================

export { ApiError } from './errors';
export type { TokenProvider } from './errors';
export type { RequestConfig, ApiErrorResponse, RequestId } from './types';

export { api };
export default api;
