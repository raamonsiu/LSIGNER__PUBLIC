import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnackbarProvider, useSnackbar } from './SnackbarProvider';
import { withIntlProvider } from '@/lib/i18n/test-provider';

type Severity = 'success' | 'error' | 'warning' | 'info';
type Entry = readonly [string, Severity];

function Harness({ entries }: { entries: readonly Entry[] }) {
  const { showSnackbar } = useSnackbar();
  return (
    <button
      data-testid="trigger"
      onClick={() => entries.forEach(([m, s]) => showSnackbar(m, s))}
    >
      Trigger
    </button>
  );
}

function getCloseButton() {
  return screen.getByRole('button', { name: /close/i });
}

function renderWithProvider(ui: React.ReactElement) {
  return render(withIntlProvider(ui));
}

describe('SnackbarProvider', () => {
  it('renders nothing visible until a message is shown', () => {
    renderWithProvider(
      <SnackbarProvider>
        <Harness entries={[]} />
      </SnackbarProvider>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a snackbar when showSnackbar is called', async () => {
    renderWithProvider(
      <SnackbarProvider>
        <Harness entries={[['Hello', 'info']]} />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger'));

    expect(await screen.findByText('Hello')).toBeInTheDocument();
  });

  it('defaults severity to info', async () => {
    renderWithProvider(
      <SnackbarProvider>
        <Harness entries={[['Default sev', 'info']]} />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger'));

    const alert = await screen.findByRole('alert');
    expect(alert.className).toMatch(/MuiAlert-colorInfo/);
  });

  it('uses the provided severity', async () => {
    renderWithProvider(
      <SnackbarProvider>
        <Harness entries={[['Boom', 'error']]} />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger'));

    const alert = await screen.findByRole('alert');
    expect(alert.className).toMatch(/MuiAlert-colorError/);
  });

  it('throws when useSnackbar is used outside the provider', () => {
    expect(() => render(<Harness entries={[]} />)).toThrow(
      /useSnackbar must be used within a SnackbarProvider/,
    );
  });

  it('drains the queue: messages are shown one at a time, in order', async () => {
    renderWithProvider(
      <SnackbarProvider>
        <Harness
          entries={[
            ['A', 'info'],
            ['B', 'success'],
            ['C', 'error'],
          ]}
        />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger'));

    // A is shown immediately; B and C are queued.
    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();

    // Close A -> processQueue should pick B from the queue.
    fireEvent.click(getCloseButton());
    expect(await screen.findByText('B')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();

    // Close B -> C should be picked next.
    fireEvent.click(getCloseButton());
    expect(await screen.findByText('C')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();

    // Close C -> queue is empty, nothing left to show.
    fireEvent.click(getCloseButton());
    expect(
      await screen.findByText('C', {}, { timeout: 50 }),
    ).toBeInTheDocument();
    // After the exit transition, the alert should be gone.
    expect(
      await screen.findByRole('alert', {}, { timeout: 1000 }),
    ).toBeInTheDocument();
  });
});
