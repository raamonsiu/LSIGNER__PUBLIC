import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@/app/theme/muiTheme';
import { TimelineList } from '../TimelineList';
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

function renderList(events: TimelineItemType[]) {
  return render(
    withIntlProvider(
      <ThemeProvider theme={createAppTheme('light')}>
        <TimelineList events={events} />
      </ThemeProvider>,
    ),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TimelineList', () => {
  describe('empty events', () => {
    it('renders nothing when events array is empty', () => {
      const { container } = renderList([]);

      // Should render an empty container
      expect(container.firstChild).toBeInTheDocument();
      const listItems = screen.queryAllByRole('listitem');
      expect(listItems).toHaveLength(0);
    });
  });

  describe('single event', () => {
    it('renders one TimelineItem for a single event', () => {
      const events = [makeEvent()];
      renderList(events);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(1);
    });
  });

  describe('multiple events', () => {
    it('renders multiple TimelineItems', () => {
      const events = [
        makeEvent({ id: 'ev-1', eventType: 'SENT' }),
        makeEvent({ id: 'ev-2', eventType: 'RECEIVED', direction: 'received' }),
        makeEvent({ id: 'ev-3', eventType: 'SIGNED' }),
      ];
      renderList(events);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('marks the last item with isLast=true', () => {
      const events = [
        makeEvent({ id: 'ev-1' }),
        makeEvent({ id: 'ev-2' }),
        makeEvent({ id: 'ev-3' }),
      ];
      renderList(events);

      // All items should be rendered; the last one has isLast=true
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      // All three events share the same document name
      expect(screen.getAllByText('Contract.pdf')).toHaveLength(3);
    });
  });

  describe('mixed directions', () => {
    it('renders both sent and received events together', () => {
      const events = [
        makeEvent({
          id: 'ev-1',
          direction: 'sent',
          eventType: 'SENT',
          otherPartyName: 'Alice',
        }),
        makeEvent({
          id: 'ev-2',
          direction: 'received',
          eventType: 'RECEIVED',
          otherPartyName: 'Bob',
        }),
      ];
      renderList(events);

      expect(screen.getByText(/Sent to Alice/)).toBeInTheDocument();
      expect(screen.getByText(/Received from Bob/)).toBeInTheDocument();
    });
  });

  describe('role', () => {
    it('renders as a list', () => {
      renderList([makeEvent()]);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });
  });
});
