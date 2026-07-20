import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmStep } from '../ConfirmStep';
import type { WizardRecipient } from '../RecipientsStep';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConfirmStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultRecipients: WizardRecipient[] = [
    { email: 'alice@example.com', name: 'Alice', saveAsContact: false },
  ];

  it('renders document summary with title and description', () => {
    render(
      withIntlProvider(
        <ConfirmStep
          title="Contract"
          description="Important document"
          recipients={defaultRecipients}
        />,
      ),
    );

    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('Important document')).toBeInTheDocument();
  });

  it('shows recipient count', () => {
    render(
      withIntlProvider(
        <ConfirmStep
          title="Doc"
          description=""
          recipients={[
            { email: 'a@a.com', name: 'A', saveAsContact: false },
            { email: 'b@b.com', name: 'B', saveAsContact: false },
          ]}
        />,
      ),
    );

    expect(screen.getByText(/2 recipient/)).toBeInTheDocument();
  });

  it('shows recipient emails in summary', () => {
    render(
      withIntlProvider(
        <ConfirmStep
          title="Doc"
          description=""
          recipients={[
            { email: 'alice@example.com', name: 'Alice', saveAsContact: false },
            { email: 'bob@test.com', name: 'Bob', saveAsContact: true },
          ]}
        />,
      ),
    );

    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/bob@test.com/)).toBeInTheDocument();
  });

  it('does NOT render a send button', () => {
    render(
      withIntlProvider(
        <ConfirmStep
          title="Doc"
          description=""
          recipients={defaultRecipients}
        />,
      ),
    );

    expect(
      screen.queryByRole('button', { name: /send/i }),
    ).not.toBeInTheDocument();
  });
});
