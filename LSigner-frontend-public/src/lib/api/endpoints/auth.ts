/**
 * API functions for authentication (login, logout, profile fetch).
 *
 * All functions use the shared `api` fetch client and throw `ApiError` on any
 * non-2xx response so callers can branch on `statusCode`, `validationMessages`, etc.
 */
import { api } from '@/lib/api';
import type { AuthUser, LoginResponse } from './types';

/**
 * POST /auth/login : exchanges email + password for an access/refresh token pair.
 * Does not return user data; call `getMeApi` with the access token to fetch it.
 * @param email Registered email address
 * @param password Plain-text password (min 8 chars)
 */
export async function loginApi(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return api.post<LoginResponse>(
    '/auth/login',
    { email, password },
    { skipAuth: true },
  );
}

/**
 * GET /users/me : returns the authenticated user's profile.
 * @param accessToken Short-lived JWT issued by loginApi / refreshApi
 */
export async function getMeApi(accessToken: string): Promise<AuthUser> {
  return api.get<AuthUser>('/users/me', { token: accessToken });
}

/**
 * POST /auth/logout : revokes the provided refresh token server-side.
 * Requires a valid access token (injected by the token provider).
 * Errors are intentionally swallowed by callers : the client session is
 * cleared regardless.
 * @param refreshToken Opaque refresh token stored in the session
 */
export async function logoutApi(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refresh_token: refreshToken });
}

/**
 * POST /auth/verify-password : verifies the current user's password.
 * Used before allowing changes to sensitive profile fields (email, phone).
 * @param password Plain-text current password
 */
export async function verifyPasswordApi(password: string): Promise<void> {
  await api.post('/auth/verify-password', { password });
}

/**
 * POST /auth/refresh : exchanges a refresh token for new access/refresh tokens.
 * Uses skipAuth: true because the access token is expired at this point.
 * @param refreshToken Opaque refresh token stored in the session
 */
export async function refreshApi(refreshToken: string): Promise<LoginResponse> {
  return api.post<LoginResponse>(
    '/auth/refresh',
    { refresh_token: refreshToken },
    { skipAuth: true },
  );
}
