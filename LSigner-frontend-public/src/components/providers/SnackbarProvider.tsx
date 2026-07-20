'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';
import MuiSnackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

// === Types ====================================================================

type Severity = 'success' | 'error' | 'warning' | 'info';

interface SnackbarMessage {
  message: string;
  severity: Severity;
  key: number;
}

interface SnackbarContextValue {
  /** Show a snackbar notification */
  showSnackbar: (message: string, severity?: Severity) => void;
}

interface SnackbarState {
  queue: SnackbarMessage[];
  current: SnackbarMessage | undefined;
  isShown: boolean;
}

const INITIAL_STATE: SnackbarState = {
  queue: [],
  current: undefined,
  isShown: false,
};

// === Context ==================================================================

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

// === Provider =================================================================

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('errors');
  const [state, setState] = useState<SnackbarState>(INITIAL_STATE);

  const showSnackbar = useCallback(
    (message: string, severity: Severity = 'info') => {
      const entry: SnackbarMessage = { message, severity, key: Date.now() };
      setState((prev) => {
        if (!prev.isShown && !prev.current) {
          return { ...prev, current: entry, isShown: true };
        }
        return { ...prev, queue: [...prev.queue, entry] };
      });
    },
    [],
  );

  // Listen for auth:expired custom event (dispatched by AuthContext on 401).
  useEffect(() => {
    function handleAuthExpired() {
      showSnackbar(t('session_expired'), 'warning');
    }

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, [showSnackbar, t]);

  const processQueue = useCallback(() => {
    setState((prev) => {
      if (prev.queue.length === 0) {
        return { ...prev, current: undefined };
      }
      const [first, ...rest] = prev.queue;
      return { queue: rest, current: first, isShown: true };
    });
  }, []);

  const handleClose = (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return; // Don't close on clickaway to allow users to interact with the snackbar
    setState((prev) => ({ ...prev, isShown: false }));
  };

  const handleExited = () => {
    processQueue();
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <MuiSnackbar
        key={state.current?.key}
        open={state.isShown}
        autoHideDuration={4000}
        onClose={handleClose}
        slotProps={{ transition: { onExited: handleExited } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={state.current?.severity ?? 'info'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {state.current?.message}
        </Alert>
      </MuiSnackbar>
    </SnackbarContext.Provider>
  );
}

// === Hook =====================================================================

/**
 * Access the global snackbar queue.
 * Must be used inside `<SnackbarProvider>`.
 */
export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
