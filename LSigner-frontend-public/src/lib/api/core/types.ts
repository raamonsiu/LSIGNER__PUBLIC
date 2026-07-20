/**
 * Common API types shared by the HTTP client and Route Handlers.
 *
 * The error shape mirrors the backend's `AllExceptionsFilter` payload
 * (see `LSigner-backend/src/common/filters/all-exceptions.filter.ts`).
 */

/** Raw error payload returned by every backend endpoint. */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: RequestId;
}

/** A request-scoped identifier used for log correlation. */
export type RequestId = string;

/** Configuration for a single API call. */
export interface RequestConfig {
  /** Per-request timeout override in milliseconds. */
  timeout?: number;
  /** Extra headers merged on top of the defaults. */
  headers?: Record<string, string>;
  /** External abort signal (e.g. from React 19's `use()` or `AbortController`). */
  signal?: AbortSignal;
  /** Query string parameters, serialised into the URL. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** Skip the default JSON `Content-Type` / `Accept` headers. */
  raw?: boolean;
  /** Do not attach the bearer token even if one is available. */
  skipAuth?: boolean;
  /** Provide a token explicitly, bypassing the global provider. */
  token?: string | null;
  /** Request body — serialised to JSON unless `raw` is set. */
  body?: unknown;
}

/** Parsed success body: either JSON `unknown`, or `null` for 204/empty bodies. */
export type ApiResponse<T> = T;
