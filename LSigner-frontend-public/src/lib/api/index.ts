/**
 * Public entry point for the API layer.
 *
 * Use `api` for everyday calls; `setTokenProvider` to plug in an auth
 * token source; `ApiError` to branch on failure modes.
 */

export {
  api,
  apiRequest,
  getToken,
  setTokenProvider,
  setOnUnauthorized,
  setRefreshSession,
  triggerRefresh,
} from './core/client';
export type { ApiClient, HttpMethod } from './core/client';

export { ApiError } from './core/errors';
export type { TokenProvider } from './core/errors';

export type { RequestConfig, ApiErrorResponse, RequestId } from './core/types';

export { API_BASE_URL, API_DEFAULT_TIMEOUT_MS } from './core/config';
