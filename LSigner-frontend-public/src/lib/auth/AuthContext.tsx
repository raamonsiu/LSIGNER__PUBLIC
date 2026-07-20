'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  setTokenProvider,
  setOnUnauthorized,
  setRefreshSession,
} from '@/lib/api';
import {
  getMeApi,
  loginApi,
  logoutApi,
  refreshApi,
} from '@/lib/api/endpoints/auth';
import { registerApi } from '@/lib/api/endpoints/users';
import type { AuthUser, RegisterDto, StoredSession } from '@/lib/auth/types';

// === Constants ================================================================

export const SESSION_KEY = 'lsigner_session';

// === Types ====================================================================

interface AuthContextValue {
  /** The authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** True if the user is authenticated */
  isAuthenticated: boolean;
  /** True once local session restoration has finished. */
  isSessionRestored: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => void;
  /** Replace the stored user data (e.g. after a profile update). */
  updateUser: (user: AuthUser) => void;
}

// === Context ==================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// === Helpers ==================================================================

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    // When JSON parsing fails or the browser blocks access to localStorage
    return null;
  }
}

function writeSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function isExpired(session: StoredSession): boolean {
  return Date.now() >= session.expiresAt;
}

// === Provider =================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const replace = router.replace;
  // Intentionally initialised as null : reading localStorage during SSR
  // would produce different values on server vs client, causing hydration
  // mismatches. The session is restored in the useEffect below.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSessionRestored, setIsSessionRestored] = useState(false);

  // On mount: restore session from localStorage and register the token
  // provider so api.get/post can inject the Bearer header automatically.
  useEffect(() => {
    const session = readSession();

    if (session && isExpired(session)) {
      clearSession();
      setTokenProvider(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSessionRestored(true);
      replace('/login?reason=expired');
      return;
    }

    if (session) {
      setTokenProvider(() => session.accessToken);

      setUser(session.user);
    }

    // Register the 401 handler: when the API client cannot recover via refresh,
    // clear the session, notify the SnackbarProvider, and redirect to login.
    setOnUnauthorized(() => {
      clearSession();
      setTokenProvider(null);
      window.dispatchEvent(new CustomEvent('auth:expired'));
      replace('/login?reason=expired');
    });

    // Register the refresh handler: attempts to exchange the stored refresh
    // token for new tokens. Returns true on success (so the request is retried)
    // or false on failure (so the 401 handler fires).
    setRefreshSession(async () => {
      const currentSession = readSession();
      if (!currentSession?.refreshToken) return false;

      try {
        const tokens = await refreshApi(currentSession.refreshToken);
        const userProfile = await getMeApi(tokens.access_token);
        const newSession: StoredSession = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          user: userProfile,
        };
        writeSession(newSession);
        setTokenProvider(() => tokens.access_token);
        setUser(userProfile);
        return true;
      } catch {
        return false;
      }
    });

    setIsSessionRestored(true);

    return () => {
      setTokenProvider(null);
      setOnUnauthorized(null);
      setRefreshSession(null);
    };
  }, [replace]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await loginApi(email, password);
    // Fetch the user profile first using the explicit token : only register
    // the global token provider once the entire login pipeline succeeds so
    // we never leave a partial state behind.
    const userProfile = await getMeApi(tokens.access_token);
    const session: StoredSession = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      user: userProfile,
    };
    writeSession(session);
    setTokenProvider(() => tokens.access_token);
    setUser(userProfile);
  }, []);

  const register = useCallback(async (dto: RegisterDto) => {
    await registerApi(dto);
  }, []);

  const updateUser = useCallback((nextUser: AuthUser) => {
    const session = readSession();
    if (session) {
      session.user = nextUser;
      writeSession(session);
    }
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    const session = readSession();
    // Fire-and-forget: revoke the refresh token server-side.
    // We clear the local session regardless of whether the call succeeds.
    if (session?.refreshToken) {
      logoutApi(session.refreshToken).catch(() => undefined);
    }
    clearSession();
    setTokenProvider(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isSessionRestored,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// === Hook =====================================================================

/**
 * Access the global authentication state and actions.
 * Must be used inside `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
