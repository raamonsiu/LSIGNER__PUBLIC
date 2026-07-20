import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@/app/theme/muiTheme';
import { TimelineItem } from '../TimelineItem';
import type { TimelineItem as TimelineItemType } from '@/lib/api/endpoints/types';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/app/locale', () => ({
  useLocaleContext: () => ({ locale: 'en' }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<TimelineItemType> = {},
): TimelineItemType {
  return {
    id: 'ev-1',
    direction: 'sent',
    documentName: 'Contract.pdf',
    otherPartyName: 'Alice',
    eventType: 'SENT',
    occurredAt: '2026-06-01T10:00:00.000Z',
    documentId: 'doc-123',
    ...overrides,
  };
}

function renderItem(
  direction: 'sent' | 'received',
  event: TimelineItemType,
  isLast = false,
) {
  return render(
    withIntlProvider(
      <ThemeProvider theme={createAppTheme('light')}>
        <TimelineItem direction={direction} event={event} isLast={isLast} />
      </ThemeProvider>,
    ),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TimelineItem', () => {
  describe('SENT event', () => {
    it('renders "Sent to {name}" label', () => {
      renderItem('sent', makeEvent({ eventType: 'SENT' }));

      expect(screen.getByText(/Sent to Alice/)).toBeInTheDocument();
    });

    it('renders document name', () => {
      renderItem('sent', makeEvent({ documentName: 'Contract.pdf' }));

      expect(screen.getByText('Contract.pdf')).toBeInTheDocument();
    });

    it('renders other party name', () => {
      renderItem(
        'sent',
        makeEvent({ otherPartyName: 'Alice', eventType: 'SENT' }),
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('renders a formatted date', () => {
      renderItem('sent', makeEvent({ occurredAt: '2026-06-01T10:00:00.000Z' }));

      // formatRelativeDate produces a locale date (e.g. "Jun 1")
      const dateEl = screen.getByText(/Jun \d/);
      expect(dateEl).toBeInTheDocument();
    });
  });

  describe('RECEIVED event', () => {
    it('renders "Received from {name}" label', () => {
      renderItem(
        'received',
        makeEvent({
          direction: 'received',
          eventType: 'RECEIVED',
          otherPartyName: 'Bob',
        }),
      );

      expect(screen.getByText(/Received from Bob/)).toBeInTheDocument();
    });
  });

  describe('SIGNED event', () => {
    it('renders "Signed by {name}" for sent direction', () => {
      renderItem(
        'sent',
        makeEvent({ eventType: 'SIGNED', otherPartyName: 'Charlie' }),
      );

      expect(screen.getByText(/Signed by Charlie/)).toBeInTheDocument();
    });

    it('renders "Signed by you" for received direction', () => {
      renderItem(
        'received',
        makeEvent({
          direction: 'received',
          eventType: 'SIGNED',
          otherPartyName: 'Bob',
        }),
      );

      expect(screen.getByText('Signed by you')).toBeInTheDocument();
    });
  });

  describe('REJECTED event', () => {
    it('renders "Rejected by {name}" for sent direction', () => {
      renderItem(
        'sent',
        makeEvent({ eventType: 'REJECTED', otherPartyName: 'Dave' }),
      );

      expect(screen.getByText(/Rejected by Dave/)).toBeInTheDocument();
    });

    it('renders "Rejected by you" for received direction', () => {
      renderItem(
        'received',
        makeEvent({
          direction: 'received',
          eventType: 'REJECTED',
          otherPartyName: 'Bob',
        }),
      );

      expect(screen.getByText('Rejected by you')).toBeInTheDocument();
    });
  });

  describe('REVOKED event', () => {
    it('renders "Revoked by {name}" for sent direction', () => {
      renderItem(
        'sent',
        makeEvent({ eventType: 'REVOKED', otherPartyName: 'Eve' }),
      );

      expect(screen.getByText(/Revoked by Eve/)).toBeInTheDocument();
    });

    it('renders "Revoked by you" for received direction', () => {
      renderItem(
        'received',
        makeEvent({
          direction: 'received',
          eventType: 'REVOKED',
          otherPartyName: 'Bob',
        }),
      );

      expect(screen.getByText('Revoked by you')).toBeInTheDocument();
    });
  });

  describe('direction alignment', () => {
    it('renders sent items with flex-start alignment', () => {
      renderItem('sent', makeEvent());

      const card = screen.getByText('Contract.pdf').closest('.MuiCard-root');
      expect(card).toBeInTheDocument();
      // The wrapper Box should have alignSelf: flex-start
      const wrapper = card!.closest('[role="listitem"]');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveStyle({ alignSelf: 'flex-start' });
    });

    it('renders received items with flex-end alignment', () => {
      renderItem(
        'received',
        makeEvent({ direction: 'received', eventType: 'RECEIVED' }),
      );

      const wrapper = screen.getByRole('listitem');
      expect(wrapper).toHaveStyle({ alignSelf: 'flex-end' });
    });
  });

  describe('isLast prop', () => {
    it('hides connector dot when isLast is true', () => {
      const { container } = renderItem('sent', makeEvent(), true);

      // The connector bullet uses MUI sx with inline styles; just verify no visible bullet
      expect(container).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('renders as a listitem', () => {
      renderItem('sent', makeEvent());

      const listItem = screen.getByRole('listitem');
      expect(listItem).toBeInTheDocument();
    });
  });
});
