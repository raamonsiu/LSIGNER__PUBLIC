/**
 * API functions for user management (register, profile update, search).
 *
 * All functions use the shared `api` fetch client and throw `ApiError` on any
 * non-2xx response so callers can branch on `statusCode`, `validationMessages`, etc.
 */
import { api } from '@/lib/api';
import type {
  AuthUser,
  RegisterDto,
  UpdateUserDto,
  UserSearchResult,
} from './types';

/**
 * POST /users : registers a new user account.
 * @param dto Registration payload matching CreateUserDto
 */
export async function registerApi(dto: RegisterDto): Promise<void> {
  await api.post('/users', dto, { skipAuth: true });
}

/**
 * PATCH /users/me : updates the authenticated user's profile.
 * @param dto Partial profile fields to update
 * @returns Updated AuthUser
 */
export async function updateUserApi(dto: UpdateUserDto): Promise<AuthUser> {
  return api.patch<AuthUser>('/users/me', dto);
}

/**
 * GET /users/search?q= : search registered users by name, email, or last name.
 * @param query Search term (partial, case-insensitive match)
 * @returns Up to 20 matching users with safe fields (id, name, last_name, email)
 */
export async function searchUsersApi(
  query: string,
): Promise<UserSearchResult[]> {
  return api.get<UserSearchResult[]>('/users/search', {
    params: { q: query },
  });
}

/**
 * DELETE /users/me/delete : permanently deletes the authenticated user's account.
 * On success, the caller should clear the session and redirect to login.
 * @returns API response message
 */
export async function deleteMyAccountApi(): Promise<{ message: string }> {
  return api.delete<{ message: string }>('/users/me/delete');
}
