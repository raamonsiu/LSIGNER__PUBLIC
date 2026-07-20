import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@/app/theme/muiTheme';
import HistoryPage from '../page';
import type { TimelineItem } from '@/lib/api/endpoints/types';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRetry = vi.fn();

vi.mock('../hooks/useTimelineEvents', () => ({
  useTimelineEvents: vi.fn(),
}));

vi.mock('@/app/locale', () => ({
  useLocaleContext: () => ({ locale: 'en' }),
}));

import { useTimelineEvents } from '../hooks/useTimelineEvents';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<TimelineItem> = {}): TimelineItem {
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

function renderPage() {
  return render(
    withIntlProvider(
      <ThemeProvider theme={createAppTheme('light')}>
        <HistoryPage />
      </ThemeProvider>,
    ),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRetry.mockClear();
  });

  describe('loading state', () => {
    it('renders skeletons while loading', () => {
      vi.mocked(useTimelineEvents).mockReturnValue({
        events: [],
        loading: true,
        error: null,
        retry: mockRetry,
      });

      renderPage();

      // MUI Skeleton renders as span with animation class
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('empty state (REQ-HIST-006)', () => {
    it('renders empty message when events array is empty', () => {
      vi.mocked(useTimelineEvents).mockReturnValue({
        events: [],
        loading: false,
        error: null,
        retry: mockRetry,
      });

      renderPage();

      expect(screen.getByText('No documents yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Sent and received document activity will appear here.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('error state (REQ-HIST-007)', () => {
    it('renders error message with retry button', () => {
      vi.mocked(useTimelineEvents).mockReturnValue({
        events: [],
        loading: false,
        error: 'Failed to load history',
        retry: mockRetry,
      });

      renderPage();

      // i18n key history.error.title resolves to "Error loading history",
      // NOT the raw hook error string "Failed to load history"
      expect(screen.getByText('Error loading history')).toBeInTheDocument();
      const retryButton = screen.getByRole('button', { name: /Try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('calls retry when retry button is clicked', async () => {
      vi.mocked(useTimelineEvents).mockReturnValue({
        events: [],
        loading: false,
        error: 'Failed to load history',
        retry: mockRetry,
      });

      renderPage();

      const retryButton = screen.getByRole('button', { name: /Try again/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockRetry).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('populated state', () => {
    it('renders timeline items when events exist', () => {
      const events = [
        makeEvent({ id: 'ev-1', eventType: 'SENT' }),
        makeEvent({
          id: 'ev-2',
          direction: 'received',
          eventType: 'RECEIVED',
          otherPartyName: 'Bob',
        }),
        makeEvent({
          id: 'ev-3',
          eventType: 'SIGNED',
          otherPartyName: 'Charlie',
        }),
      ];

      vi.mocked(useTimelineEvents).mockReturnValue({
        events,
        loading: false,
        error: null,
        retry: mockRetry,
      });

      renderPage();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      expect(screen.getByText(/Sent to Alice/)).toBeInTheDocument();
      expect(screen.getByText(/Received from Bob/)).toBeInTheDocument();
    });
  });

  describe('page title', () => {
    it('renders the History title', () => {
      vi.mocked(useTimelineEvents).mockReturnValue({
        events: [],
        loading: false,
        error: null,
        retry: mockRetry,
      });

      renderPage();

      expect(screen.getByText('History')).toBeInTheDocument();
    });
  });
});
