/**
 * Typed error classes that wrap the backend's `AllExceptionsFilter` payload.
 *
 * Every HTTP failure surfaced by the API client is an `ApiError` instance,
 * carrying the same fields the backend emits so callers can branch on
 * `statusCode` (e.g. `401`, `403`, `404`, `409`, `422`, `5xx`) or inspect
 * the human-readable `message`.
 */

import type { ApiErrorResponse } from './types';

/** A function that returns the current bearer token, or `null` if none. */
export type TokenProvider = () => string | null | Promise<string | null>;

/**
 * Thrown for any non-2xx response, network failure, abort, or timeout
 * triggered by the API client.
 */
export class ApiError extends Error {
  /** HTTP status code (`0` for transport-layer errors). */
  readonly statusCode: number;
  /** Short textual error label (e.g. `"Bad Request"`). */
  readonly error: string;
  /** ISO timestamp from the backend (empty for transport errors). */
  readonly timestamp: string;
  /** Correlation id from the backend (empty for transport errors). */
  readonly requestId: string;
  /** Raw decoded response body for inspection. */
  readonly body: unknown;
  /** `true` for 4xx responses (client error). */
  readonly isClientError: boolean;
  /** `true` for 5xx responses (server error). */
  readonly isServerError: boolean;
  /** `true` when the request was aborted (timeout or external signal). */
  readonly isAbort: boolean;
  /** @internal Backing field for the `path` getter. */
  private _path: string;

  constructor(init: {
    statusCode: number;
    error: string;
    message: string;
    path?: string;
    timestamp?: string;
    requestId?: string;
    body?: unknown;
    isAbort?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.statusCode = init.statusCode;
    this.error = init.error;
    this._path = init.path ?? '';
    this.timestamp = init.timestamp ?? '';
    this.requestId = init.requestId ?? '';
    this.body = init.body;
    this.isAbort = init.isAbort ?? false;
    this.isClientError = init.statusCode >= 400 && init.statusCode < 500;
    this.isServerError = init.statusCode >= 500 && init.statusCode < 600;
  }

  /** @internal Allows the client to backfill the originating request path. */
  setPath(value: string): void {
    if (!this._path) this._path = value;
  }

  /** Original request path that produced the error. */
  get path(): string {
    return this._path;
  }

  /**
   * If the backend returned a 400 with field-level validation messages
   * (`message: string[]`), returns them. Otherwise `null`.
   */
  get validationMessages(): string[] | null {
    return Array.isArray(this.body) ||
      (this.body &&
        typeof this.body === 'object' &&
        Array.isArray((this.body as { message?: unknown }).message))
      ? ((this.body as { message: string[] }).message as string[])
      : null;
  }

  /** Build an `ApiError` from a raw backend payload, if it matches the shape. */
  static fromResponse(
    payload: unknown,
    fallbackStatus: number,
    fallbackMessage: string,
  ): ApiError {
    if (isApiErrorResponse(payload)) {
      return new ApiError({
        statusCode: payload.statusCode,
        error: payload.error,
        message: toMessage(payload.message) ?? fallbackMessage,
        path: payload.path,
        timestamp: payload.timestamp,
        requestId: payload.requestId,
        body: payload,
      });
    }
    return new ApiError({
      statusCode: fallbackStatus,
      error: 'Error',
      message:
        typeof payload === 'string' && payload.length > 0
          ? payload
          : fallbackMessage,
      body: payload,
    });
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['statusCode'] === 'number' &&
    typeof v['error'] === 'string' &&
    'message' in v &&
    typeof v['path'] === 'string' &&
    typeof v['timestamp'] === 'string'
  );
}

function toMessage(message: string | string[]): string {
  return Array.isArray(message) ? message.join('; ') : message;
}
