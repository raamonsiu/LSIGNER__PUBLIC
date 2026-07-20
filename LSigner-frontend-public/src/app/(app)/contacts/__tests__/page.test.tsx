import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import ContactsPage from '../page';
import { getContactsApi, deleteContactApi } from '@/lib/api/endpoints/contacts';
import type { ContactResponse } from '@/lib/api/endpoints/types';
import { withIntlProvider } from '@/lib/i18n/test-provider';

vi.mock('@/lib/api/endpoints/contacts', () => ({
  getContactsApi: vi.fn(),
  deleteContactApi: vi.fn(),
  createContactApi: vi.fn(),
}));

// Mock next-intl
vi.mock('@/app/locale', () => ({
  useLocaleContext: () => ({ locale: 'en' }),
}));

// Mock snackbar
vi.mock('@/components/providers/SnackbarProvider', () => ({
  useSnackbar: () => ({ showSnackbar: vi.fn() }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeContact = (
  overrides: Partial<ContactResponse> = {},
): ContactResponse => ({
  id: 'c-1',
  contact_email: 'alice@example.com',
  contact_name: 'Alice',
  contact_phone: null,
  contact_user_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContactsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(getContactsApi).mockImplementation(() => new Promise(() => {}));

    render(withIntlProvider(<ContactsPage />));

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders contact list after loading', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({
        id: 'c1',
        contact_email: 'alice@example.com',
        contact_name: 'Alice',
      }),
      makeContact({
        id: 'c2',
        contact_email: 'bob@test.com',
        contact_name: null,
      }),
    ]);

    render(withIntlProvider(<ContactsPage />));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
  });

  it('shows empty state when no contacts', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([]);

    render(withIntlProvider(<ContactsPage />));

    await waitFor(() => {
      expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument();
    });
  });

  it('deletes a contact', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({
        id: 'c1',
        contact_email: 'alice@example.com',
        contact_name: 'Alice',
      }),
    ]);
    vi.mocked(deleteContactApi).mockResolvedValue(undefined);

    render(withIntlProvider(<ContactsPage />));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(deleteContactApi).toHaveBeenCalledWith('c1');
  });

  it('shows error message on load failure', async () => {
    vi.mocked(getContactsApi).mockRejectedValue(new Error('Failed'));

    render(withIntlProvider(<ContactsPage />));

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
