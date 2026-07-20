'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export type SettingsSection =
  | 'user'
  | 'platform'
  | 'docs'
  | 'cookies'
  | 'danger-zone';

interface SettingsContextValue {
  activeSection: SettingsSection | null;
  setActiveSection: (section: SettingsSection | null) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(
    null,
  );

  const handleSetActiveSection = useCallback(
    (section: SettingsSection | null) => {
      setActiveSection(section);
    },
    [],
  );

  return (
    <SettingsContext.Provider
      value={{ activeSection, setActiveSection: handleSetActiveSection }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error(
      'useSettingsContext must be used within a SettingsProvider',
    );
  }
  return context;
}
