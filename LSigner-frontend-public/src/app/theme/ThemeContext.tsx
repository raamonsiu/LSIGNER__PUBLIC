'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from './muiTheme';

// == Types ==================================================================

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

// == Constants =============================================================

const THEME_COOKIE = 'theme';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

// == Context ================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Hook to access the theme context. Must be used within an AppThemeProvider.
 * Provides the current theme mode and functions to toggle or set the theme.
 */
export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context)
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  return context;
}

// == Provider ===============================================================

/**
 * Global theme provider.
 * - Exposes `mode`, `toggleTheme`, and `setTheme` via context.
 * - Persists the chosen mode in a `theme` cookie so the server can render the
 *   right `data-theme` attribute on the root <html> from the very first byte
 *   (no FOUC, no inline script, no hydration warning).
 * - Also mutates the `data-theme` attribute on the client so the in-session
 *   styles update instantly without a router roundtrip.
 * - `initialMode` comes from the server layout, which reads the cookie.
 */
export function AppThemeProvider({
  children,
  initialMode,
}: {
  children: ReactNode;
  initialMode: ThemeMode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const setTheme = useCallback((next: ThemeMode) => {
    setModeState(next);
    document.documentElement.setAttribute('data-theme', next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setTheme]);

  const muiTheme = useMemo(() => createAppTheme(mode), [mode]);

  const contextValue = useMemo(
    () => ({ mode, toggleTheme, setTheme }),
    [mode, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
