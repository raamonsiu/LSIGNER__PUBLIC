import { describe, it, expect } from 'vitest';

import en from '../en.json';
import es from '../es.json';
import ca from '../ca.json';

const NEW_KEYS = {
  'common.coming_soon': {
    en: 'Coming soon',
    es: 'Próximamente',
    ca: 'Pròximament',
  },
  'received_documents.messages.resolve_locks_first': {
    en: 'You must resolve all document locks before opening this file.',
    es: 'Debes resolver todos los bloqueos antes de abrir este archivo.',
    ca: "Has de resoldre tots els bloquejos abans d'obrir aquest fitxer.",
  },
  'topbar.notifications.unavailable_aria': {
    en: 'Notifications unavailable',
    es: 'Notificaciones no disponibles',
    ca: 'Notificacions no disponibles',
  },
  'profile.modal.close_aria': {
    en: 'Close',
    es: 'Cerrar',
    ca: 'Tancar',
  },
} as const;

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

describe('i18n — new keys for fix-i18n-and-security', () => {
  describe('en.json', () => {
    for (const [key, values] of Object.entries(NEW_KEYS)) {
      it(`has "${key}" -> "${values.en}"`, () => {
        expect(getNested(en, key)).toBe(values.en);
      });
    }
  });

  describe('es.json', () => {
    for (const [key, values] of Object.entries(NEW_KEYS)) {
      it(`has "${key}" -> "${values.es}"`, () => {
        expect(getNested(es, key)).toBe(values.es);
      });
    }
  });

  describe('ca.json', () => {
    for (const [key, values] of Object.entries(NEW_KEYS)) {
      it(`has "${key}" -> "${values.ca}"`, () => {
        expect(getNested(ca, key)).toBe(values.ca);
      });
    }
  });
});
