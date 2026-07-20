import React from 'react';
import { AuthTopBar } from '@/components/auth/AuthTopBar';

/**
 * Minimal layout for auth pages (login, register).
 * No navigation chrome : just a full-screen centered surface
 * plus a top-right bar with language switcher and theme toggle.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        padding: '24px 16px',
        position: 'relative',
      }}
    >
      <AuthTopBar />
      {children}
    </div>
  );
}
