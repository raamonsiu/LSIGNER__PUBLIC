'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { SendDocumentWizard } from '@/app/(app)/documents/send-wizard/SendDocumentWizard';

// === Types ====================================================================

export interface WizardContextValue {
  /** Open the SendDocumentWizard dialog. */
  openWizard: () => void;
  /** Close the dialog without triggering a data reload (cancel). */
  closeWizard: () => void;
  /** Close the dialog and increment the close counter (successful send). */
  finishWizard: () => void;
  /** Number of times the wizard has been finished. Used by the sent page
   *  to trigger a data refresh after a successful send. */
  closeCount: number;
}

// === Context ==================================================================

const WizardContext = createContext<WizardContextValue | null>(null);

/**
 * Access the wizard open/close functions.
 * Must be used inside `<SendDocumentWizardProvider>`.
 */
export function useWizard(): WizardContextValue {
  const contexzt = useContext(WizardContext);
  if (!contexzt) {
    throw new Error('useWizard must be used within SendDocumentWizardProvider');
  }
  return contexzt;
}

// === Provider =================================================================

export function SendDocumentWizardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [closeCount, setCloseCount] = useState(0);

  const openWizard = useCallback(() => setOpen(true), []);
  const closeWizard = useCallback(() => setOpen(false), []);
  const finishWizard = useCallback(() => {
    setOpen(false);
    setCloseCount((count) => count + 1);
  }, []);

  const value = useMemo(
    () => ({ openWizard, closeWizard, finishWizard, closeCount }),
    [openWizard, closeWizard, finishWizard, closeCount],
  );

  return (
    <WizardContext value={value}>
      {children}
      <SendDocumentWizard
        open={open}
        onClose={closeWizard}
        onSent={finishWizard}
      />
    </WizardContext>
  );
}
