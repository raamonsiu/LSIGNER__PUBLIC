/**
 * Resolved at runtime: where should the API client point, and how long
 * is each request allowed to wait?
 *
 * The base URL is read from `NEXT_PUBLIC_API_URL` so it is available in
 * both server and client bundles. Falls back to the local dev backend.
 */

const FALLBACK_BASE_URL = 'http://localhost:3000';
const FALLBACK_TIMEOUT_MS = 15_000;

/** Base URL of the backend (no trailing slash). */
export const API_BASE_URL: string = stripTrailingSlash(
  process.env['NEXT_PUBLIC_API_URL'] ?? FALLBACK_BASE_URL,
);

/** Default per-request timeout, in milliseconds. */
export const API_DEFAULT_TIMEOUT_MS: number = parseIntEnv(
  process.env['API_TIMEOUT_MS'],
  FALLBACK_TIMEOUT_MS,
);

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
