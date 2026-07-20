'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Protects a route group from unauthenticated access.
 * - On first render (SSR and client hydration): returns null because
 *   AuthContext has not yet restored the session from localStorage.
 * - After AuthContext restores the session (in useEffect), re-renders.
 * - If still unauthenticated after mount, redirects to /login.
 * - If authenticated, renders children.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isSessionRestored } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSessionRestored) return;

    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isSessionRestored, router]);

  if (!isSessionRestored) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
