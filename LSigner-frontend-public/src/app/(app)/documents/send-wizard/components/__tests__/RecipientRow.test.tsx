import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecipientRow } from '../RecipientRow';
import type { RecipientEntry } from '../ContactSearchAutocomplete';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeRecipient = (
  overrides: Partial<RecipientEntry> = {},
): RecipientEntry => ({
  email: 'alice@example.com',
  name: 'Alice',
  type: 'contact',
  contactId: 'c1',
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecipientRow', () => {
  it('renders recipient email and name', () => {
    const recipient = makeRecipient();
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={vi.fn()}
          onToggleSaveContact={vi.fn()}
        />,
      ),
    );

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders email as fallback when name is empty', () => {
    const recipient = makeRecipient({ name: '' });
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={vi.fn()}
          onToggleSaveContact={vi.fn()}
        />,
      ),
    );

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows "manual" type indicator for manual entries', () => {
    const recipient = makeRecipient({ type: 'manual', contactId: undefined });
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={vi.fn()}
          onToggleSaveContact={vi.fn()}
        />,
      ),
    );

    expect(screen.getByText(/manual/i)).toBeInTheDocument();
  });

  it('shows "Save as contact" checkbox', () => {
    const recipient = makeRecipient({ type: 'manual', contactId: undefined });
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={vi.fn()}
          onToggleSaveContact={vi.fn()}
          saveAsContact={false}
        />,
      ),
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /save as contact/i,
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('reflects saveAsContact checked state', () => {
    const recipient = makeRecipient({ type: 'manual', contactId: undefined });
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={vi.fn()}
          onToggleSaveContact={vi.fn()}
          saveAsContact={true}
        />,
      ),
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /save as contact/i,
    });
    expect(checkbox).toBeChecked();
  });

  it('calls onToggleSaveContact when checkbox is toggled', () => {
    const onToggleSaveContact = vi.fn();
    const recipient = makeRecipient({ type: 'manual', contactId: undefined });
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={vi.fn()}
          onToggleSaveContact={onToggleSaveContact}
          saveAsContact={false}
        />,
      ),
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /save as contact/i,
    });
    fireEvent.click(checkbox);
    expect(onToggleSaveContact).toHaveBeenCalledWith(recipient.email);
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    const recipient = makeRecipient();
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={onRemove}
          onToggleSaveContact={vi.fn()}
        />,
      ),
    );

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledWith(recipient.email);
  });

  it('hides "Save as contact" for contacts that already exist', () => {
    const recipient = makeRecipient({
      type: 'contact',
      contactId: 'c-existing',
    });
    render(
      withIntlProvider(
        <RecipientRow
          recipient={recipient}
          onRemove={vi.fn()}
          onToggleSaveContact={vi.fn()}
        />,
      ),
    );

    // Save as contact checkbox should not appear for existing contacts
    const checkbox = screen.queryByRole('checkbox', {
      name: /save as contact/i,
    });
    expect(checkbox).toBeNull();
  });
});
