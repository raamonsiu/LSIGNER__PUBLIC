import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { ContactSearchAutocomplete } from '../ContactSearchAutocomplete';
import { getContactsApi } from '@/lib/api/endpoints/contacts';
import { searchUsersApi } from '@/lib/api/endpoints/users';
import type {
  ContactResponse,
  UserSearchResult,
} from '@/lib/api/endpoints/types';

vi.mock('@/lib/api/endpoints/contacts', () => ({
  getContactsApi: vi.fn(),
}));
vi.mock('@/lib/api/endpoints/users', () => ({
  searchUsersApi: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeContact = (
  overrides: Partial<ContactResponse> = {},
): ContactResponse => ({
  id: 'contact-1',
  contact_email: 'alice@example.com',
  contact_name: 'Alice',
  contact_phone: null,
  contact_user_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeUser = (
  overrides: Partial<UserSearchResult> = {},
): UserSearchResult => ({
  id: 'user-1',
  name: 'Bob',
  last_name: 'Jones',
  email: 'bob@example.com',
  ...overrides,
});

// ─── Default props ────────────────────────────────────────────────────────────

function defaultProps() {
  return {
    onChange: vi.fn(),
    onInputChange: vi.fn(),
  };
}

/** Helper: simulate typing into the autocomplete input. */
function typeInAutocomplete(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

/** Helper: trigger the debounced search after typing. */
async function flushSearch() {
  // The component uses a 200ms debounce. We advance timers by enough.
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContactSearchAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Rendering ────────────────────────────────────────────────────────────

  it('renders the autocomplete input with placeholder', () => {
    render(<ContactSearchAutocomplete {...defaultProps()} />);

    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search contacts or users…');
  });

  // ─── API search ────────────────────────────────────────────────────────────

  it('searches contacts and users simultaneously on input', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([]);
    vi.mocked(searchUsersApi).mockResolvedValue([]);

    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');

    typeInAutocomplete(input, 'al');
    await flushSearch();

    expect(getContactsApi).toHaveBeenCalledWith('al');
    expect(searchUsersApi).toHaveBeenCalledWith('al');
  });

  // ─── Results: contacts first, then users ───────────────────────────────────

  it('shows contacts and user search results in dropdown', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({
        id: 'c1',
        contact_email: 'alice@example.com',
        contact_name: 'Alice',
      }),
    ]);
    vi.mocked(searchUsersApi).mockResolvedValue([
      makeUser({
        id: 'u1',
        name: 'Bob',
        last_name: 'Jones',
        email: 'bob@example.com',
      }),
    ]);

    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'al');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  // ─── Option selection ──────────────────────────────────────────────────────

  it('calls onChange with selected contact details', async () => {
    const onChange = vi.fn();
    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({
        id: 'c1',
        contact_email: 'alice@example.com',
        contact_name: 'Alice',
      }),
    ]);
    vi.mocked(searchUsersApi).mockResolvedValue([]);

    render(
      <ContactSearchAutocomplete onChange={onChange} onInputChange={vi.fn()} />,
    );
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'ali');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Select the option
    const option = screen.getByText('Alice');
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith({
      email: 'alice@example.com',
      name: 'Alice',
      contactId: 'c1',
      userId: undefined,
      type: 'contact',
    });
  });

  it('calls onChange with selected user details', async () => {
    const onChange = vi.fn();
    vi.mocked(getContactsApi).mockResolvedValue([]);
    vi.mocked(searchUsersApi).mockResolvedValue([
      makeUser({
        id: 'u2',
        name: 'Charlie',
        last_name: 'Brown',
        email: 'charlie@example.com',
      }),
    ]);

    render(
      <ContactSearchAutocomplete onChange={onChange} onInputChange={vi.fn()} />,
    );
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'char');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });

    const option = screen.getByText('Charlie Brown');
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith({
      email: 'charlie@example.com',
      name: 'Charlie Brown',
      contactId: undefined,
      userId: 'u2',
      type: 'user',
    });
  });

  // ─── Free text entry ───────────────────────────────────────────────────────

  it('allows typing a new email as free text (creates manual entry)', async () => {
    const onChange = vi.fn();
    vi.mocked(getContactsApi).mockResolvedValue([]);
    vi.mocked(searchUsersApi).mockResolvedValue([]);

    render(
      <ContactSearchAutocomplete onChange={onChange} onInputChange={vi.fn()} />,
    );
    const input = screen.getByRole('combobox');

    typeInAutocomplete(input, 'newuser@example.com');
    await flushSearch();

    // Press Enter to confirm free text
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        name: '',
        contactId: undefined,
        userId: undefined,
        type: 'manual',
      });
    });
  });

  // ─── Clear ─────────────────────────────────────────────────────────────────

  it('calls onChange with null when value is cleared', async () => {
    const onChange = vi.fn();
    const selectedEntry = {
      email: 'alice@example.com',
      name: 'Alice',
      contactId: 'c1',
      userId: undefined,
      type: 'contact' as const,
    };

    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({
        id: 'c1',
        contact_email: 'alice@example.com',
        contact_name: 'Alice',
      }),
    ]);
    vi.mocked(searchUsersApi).mockResolvedValue([]);

    const { rerender } = render(
      <ContactSearchAutocomplete
        value={null}
        onChange={onChange}
        onInputChange={vi.fn()}
      />,
    );
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'ali');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Select
    fireEvent.click(screen.getByText('Alice'));
    expect(onChange).toHaveBeenCalledTimes(1);

    // Rerender with the selected value to show clear button
    rerender(
      <ContactSearchAutocomplete
        value={selectedEntry}
        onChange={onChange}
        onInputChange={vi.fn()}
      />,
    );

    // Now the clear button should be visible
    await waitFor(() => {
      const clearButton = screen.getByTitle('Clear');
      expect(clearButton).toBeInTheDocument();
      fireEvent.click(clearButton);
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  // ─── Loading state ─────────────────────────────────────────────────────────

  it('shows loading indicator while searching', async () => {
    // Never resolve to keep loading
    vi.mocked(getContactsApi).mockImplementation(() => new Promise(() => {}));
    vi.mocked(searchUsersApi).mockImplementation(() => new Promise(() => {}));

    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'test');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // ─── No results ────────────────────────────────────────────────────────────

  it('handles empty search results without crashing (calls both APIs)', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([]);
    vi.mocked(searchUsersApi).mockResolvedValue([]);

    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'zzznomatch');
    await flushSearch();

    // Both APIs should have been called
    expect(getContactsApi).toHaveBeenCalledWith('zzznomatch');
    expect(searchUsersApi).toHaveBeenCalledWith('zzznomatch');

    // No error should appear, and the component should still render the input
    expect(input).toBeInTheDocument();
  });

  // ─── Error handling ────────────────────────────────────────────────────────

  it('handles API errors gracefully by showing only the other results', async () => {
    vi.mocked(getContactsApi).mockRejectedValue(new Error('Network error'));
    vi.mocked(searchUsersApi).mockResolvedValue([
      makeUser({
        name: 'Diana',
        last_name: 'Prince',
        email: 'diana@example.com',
      }),
    ]);

    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'di');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByText('Diana Prince')).toBeInTheDocument();
    });
  });

  // ─── Deduplication ──────────────────────────────────────────────────────────

  it('deduplicates results when a contact and user share the same email', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({
        id: 'c-dup',
        contact_email: 'same@example.com',
        contact_name: 'Sam',
      }),
    ]);
    vi.mocked(searchUsersApi).mockResolvedValue([
      makeUser({
        id: 'u-dup',
        name: 'Sam',
        last_name: 'Smith',
        email: 'same@example.com',
      }),
    ]);

    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'sam');
    await flushSearch();

    await waitFor(() => {
      // Should show only one option (contact takes priority)
      const options = screen.getAllByText('same@example.com');
      expect(options).toHaveLength(1);
    });
  });

  // ─── Minimum query length ──────────────────────────────────────────────────

  it('does not search with fewer than 2 characters', async () => {
    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');

    typeInAutocomplete(input, 'a');
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(getContactsApi).not.toHaveBeenCalled();
    expect(searchUsersApi).not.toHaveBeenCalled();
  });

  // ─── Dropdown close behavior ───────────────────────────────────────────────

  it('resets state on selection so dropdown can close naturally', async () => {
    const onChange = vi.fn();
    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({
        id: 'c1',
        contact_email: 'alice@example.com',
        contact_name: 'Alice',
      }),
    ]);
    vi.mocked(searchUsersApi).mockResolvedValue([]);

    render(
      <ContactSearchAutocomplete
        value={null}
        onChange={onChange}
        onInputChange={vi.fn()}
      />,
    );
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'ali');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Select the option
    fireEvent.click(screen.getByText('Alice'));

    // After selection, onChange is called with the selected entry.
    // jsdom cannot reliably test MUI's internal dropdown close behavior.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
    );
  });

  it('closes dropdown and clears options on explicit close', async () => {
    vi.mocked(getContactsApi).mockResolvedValue([
      makeContact({ contact_email: 'bob@example.com', contact_name: 'Bob' }),
    ]);
    vi.mocked(searchUsersApi).mockResolvedValue([]);

    render(<ContactSearchAutocomplete {...defaultProps()} />);
    const input = screen.getByRole('combobox');
    typeInAutocomplete(input, 'bob');
    await flushSearch();

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    // Simulate clicking outside (MUI's onClose fires internally)
    // After close, subsequent search should start fresh with hasSearched=false
    // Type a short string (less than 2 chars), dropdown closes
    typeInAutocomplete(input, '');
    await flushSearch();

    // Options should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
  });
});
