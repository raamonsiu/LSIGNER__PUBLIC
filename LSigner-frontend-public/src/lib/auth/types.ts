/**
 * Authentication types.
 *
 * API contract types (AuthUser, LoginResponse, RegisterDto) live in
 * `@/lib/api/endpoints/types` to avoid a reverse dependency from the
 * API layer back into the auth module.
 */

import type { AuthUser } from '@/lib/api/endpoints/types';
export type {
  AuthUser,
  LoginResponse,
  RegisterDto,
} from '@/lib/api/endpoints/types';

/** Session stored in localStorage */
export interface StoredSession {
  accessToken: string;
  /** Opaque single-use refresh token : stored to allow server-side logout. */
  refreshToken: string;
  expiresAt: number; // Unix timestamp (ms)
  user: AuthUser;
}
