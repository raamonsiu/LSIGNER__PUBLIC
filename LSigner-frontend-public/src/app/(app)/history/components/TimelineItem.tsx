'use client';

// TODO: Factor styles
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import MarkunreadIcon from '@mui/icons-material/Markunread';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import UndoIcon from '@mui/icons-material/Undo';
import { useLocaleContext } from '@/app/locale';
import { formatRelativeDate } from '@/lib/i18n';
import type { TimelineItem as TimelineItemType } from '@/lib/api/endpoints/types';
import type { Locale } from '@/app/locale';

// === Icons ====================================================================

const EVENT_ICONS = {
  SENT: SendIcon,
  RECEIVED: MarkunreadIcon,
  SIGNED: CheckCircleIcon,
  REJECTED: CancelIcon,
  REVOKED: UndoIcon,
} as const;

// === Event label keys =========================================================

const EVENT_LABEL_KEYS: Record<string, string> = {
  SENT: 'events.sent',
  RECEIVED: 'events.received',
};

function getTerminalLabelKey(
  eventType: 'SIGNED' | 'REJECTED' | 'REVOKED',
  direction: 'sent' | 'received',
): string {
  const key =
    eventType === 'SIGNED'
      ? 'signed'
      : eventType === 'REJECTED'
        ? 'rejected'
        : 'revoked';

  return direction === 'received' ? `events.${key}ByYou` : `events.${key}`;
}

// === Color tokens =============================================================

function getEventColors(
  eventType: TimelineItemType['eventType'],
  palette: Theme['palette'],
) {
  const { chip } = palette;

  switch (eventType) {
    case 'SENT':
    case 'RECEIVED':
      return { text: chip.waitText, bg: chip.waitBg };
    case 'SIGNED':
      return { text: chip.successText, bg: chip.successBg };
    case 'REJECTED':
    case 'REVOKED':
      return { text: chip.errorText, bg: chip.errorBg };
    default:
      return { text: chip.waitText, bg: chip.waitBg };
  }
}

// === Component ================================================================

interface TimelineItemProps {
  direction: 'sent' | 'received';
  event: TimelineItemType;
  isLast: boolean;
}

export function TimelineItem({ direction, event, isLast }: TimelineItemProps) {
  const t = useTranslations('history');
  const { locale } = useLocaleContext();
  const theme = useTheme();

  const Icon = EVENT_ICONS[event.eventType] ?? MarkunreadIcon;
  const colors = getEventColors(event.eventType, theme.palette);

  const eventLabel = useMemo(() => {
    if (event.eventType === 'SENT' || event.eventType === 'RECEIVED') {
      return t(EVENT_LABEL_KEYS[event.eventType], {
        name: event.otherPartyName,
      });
    }
    return t(
      getTerminalLabelKey(
        event.eventType as 'SIGNED' | 'REJECTED' | 'REVOKED',
        direction,
      ),
      { name: event.otherPartyName },
    );
  }, [event.eventType, event.otherPartyName, direction, t]);

  const formattedDate = useMemo(
    () =>
      formatRelativeDate(
        locale as Locale,
        new Date(event.occurredAt),
        new Date(),
      ),
    [event.occurredAt, locale],
  );

  const alignSelf = direction === 'sent' ? 'flex-start' : 'flex-end';

  return (
    <Box
      role="listitem"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        alignSelf,
        width: { xs: 'calc(100% - 32px)', md: 'calc(50% - 20px)' },
        maxWidth: { md: 'calc(50% - 20px)' },
        pl: { xs: '32px', md: direction === 'sent' ? 0 : '32px' },
        pr: { xs: 0, md: direction === 'sent' ? '32px' : 0 },
        position: 'relative',
      }}
    >
      {/* Connector bullet */}
      <Box
        sx={{
          position: 'absolute',
          top: 20,
          [direction === 'sent' ? 'right' : 'left']: -8,
          width: 16,
          height: 16,
          borderRadius: '50%',
          bgcolor: colors.bg,
          border: '2px solid',
          borderColor: colors.text,
          zIndex: 1,
          ...(isLast ? { display: 'none' } : {}),
        }}
      />

      {/* Card */}
      <Card
        elevation={0}
        sx={{
          flex: 1,
          border: '2px solid',
          borderColor: colors.text,
          borderRadius: 2,
          bgcolor: 'background.paper',
          contentVisibility: 'auto',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Header row: icon + event label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: colors.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon sx={{ fontSize: 20, color: colors.text }} />
            </Box>
            <Typography
              sx={{
                fontSize: 13.5,
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              {eventLabel}
            </Typography>
          </Box>

          {/* Document name */}
          <Typography
            sx={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'text.primary',
              ml: 0.5,
            }}
          >
            {event.documentName}
          </Typography>

          {/* Metadata row: other party + date */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              ml: 0.5,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {event.otherPartyName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {formattedDate}
            </Typography>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
