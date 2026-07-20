import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { RecipientsStep } from '../RecipientsStep';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// Mock ContactSearchAutocomplete
vi.mock('../../components/ContactSearchAutocomplete', () => ({
  ContactSearchAutocomplete: ({
    onChange,
  }: {
    onChange: (entry: Record<string, unknown> | null) => void;
  }) => (
    <div>
      <input
        data-testid="search-input"
        placeholder="Search"
        onChange={() => {
          // Simulate selection
        }}
      />
      <button
        data-testid="add-alice"
        onClick={() =>
          onChange({
            email: 'alice@example.com',
            name: 'Alice',
            type: 'user',
          })
        }
      >
        Add Alice
      </button>
      <button
        data-testid="add-bob"
        onClick={() =>
          onChange({
            email: 'bob@test.com',
            name: '',
            type: 'manual',
          })
        }
      >
        Add Bob
      </button>
    </div>
  ),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecipientsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search autocomplete', () => {
    render(
      withIntlProvider(
        <RecipientsStep onRecipientsChange={vi.fn()} onError={vi.fn()} />,
      ),
    );
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('adds recipient via autocomplete selection', async () => {
    const onRecipientsChange = vi.fn();
    render(
      withIntlProvider(
        <RecipientsStep
          onRecipientsChange={onRecipientsChange}
          onError={vi.fn()}
        />,
      ),
    );

    const addBtn = screen.getByTestId('add-alice');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(onRecipientsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'alice@example.com',
          name: 'Alice',
          saveAsContact: false,
        }),
      ]),
    );
  });

  it('shows added recipients in the list', async () => {
    const onRecipientsChange = vi.fn();
    render(
      withIntlProvider(
        <RecipientsStep
          onRecipientsChange={onRecipientsChange}
          onError={vi.fn()}
        />,
      ),
    );

    // Add Alice
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-alice'));
    });

    // Alice should appear in the list
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('removes recipient from list', async () => {
    const onRecipientsChange = vi.fn();
    render(
      withIntlProvider(
        <RecipientsStep
          onRecipientsChange={onRecipientsChange}
          onError={vi.fn()}
        />,
      ),
    );

    // Add Alice
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-alice'));
    });

    // Remove Alice
    const removeBtn = screen.getByRole('button', {
      name: /remove alice@example.com/i,
    });
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    // Alice should be gone
    expect(screen.queryByText('alice@example.com')).toBeNull();
  });

  it('prevents duplicate recipients', async () => {
    const onError = vi.fn();
    render(
      withIntlProvider(
        <RecipientsStep onRecipientsChange={vi.fn()} onError={onError} />,
      ),
    );

    // Add Alice twice
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-alice'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-alice'));
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('already'));
  });

  it('toggles save as contact', async () => {
    const onRecipientsChange = vi.fn();
    render(
      withIntlProvider(
        <RecipientsStep
          onRecipientsChange={onRecipientsChange}
          onError={vi.fn()}
        />,
      ),
    );

    // Add Alice (manual type so checkbox shows)
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-alice'));
    });

    // Toggle save as contact checkbox
    const checkbox = screen.getByRole('checkbox', {
      name: /save as contact/i,
    });
    fireEvent.click(checkbox);

    expect(onRecipientsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'alice@example.com',
          saveAsContact: true,
        }),
      ]),
    );
  });
});
