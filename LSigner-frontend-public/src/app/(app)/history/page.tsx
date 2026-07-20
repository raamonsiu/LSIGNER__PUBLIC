'use client';

// TODO : Facotr styles
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import { FilledButton } from '@/components/ui';
import { useTimelineEvents } from './hooks/useTimelineEvents';
import { TimelineList } from './components/TimelineList';

// === Skeleton loader ==========================================================

function TimelineSkeleton() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        py: 2,
      }}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Box
          key={`skeleton-${index}`}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
            px: { xs: 0, md: index % 2 === 0 ? 0 : '52%' },
          }}
        >
          <Skeleton variant="circular" width={36} height={36} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="60%" height={20} />
            <Skeleton sx={{ mt: 0.5 }} width="40%" height={16} />
            <Skeleton sx={{ mt: 0.5 }} width="30%" height={14} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// === Page =====================================================================

export default function HistoryPage() {
  const t = useTranslations('history');
  const { events, loading, error, retry } = useTimelineEvents();

  return (
    <Container maxWidth="md" sx={{ py: 4, pb: '56px', px: { xs: 2, sm: 3 } }}>
      {/* Title */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          {t('title')}
        </Typography>
      </Box>

      {/* Loading state */}
      {loading && <TimelineSkeleton />}

      {/* Error state */}
      {!loading && error && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            textAlign: 'center',
          }}
        >
          <ErrorOutlinedIcon
            sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
          />
          <Typography sx={{ color: 'text.secondary', mb: 2, fontWeight: 600 }}>
            {t('error.title')}
          </Typography>
          <FilledButton onClick={() => void retry()}>
            {t('error.retry')}
          </FilledButton>
        </Box>
      )}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            textAlign: 'center',
          }}
        >
          <InboxIcon
            sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }}
          />
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}
          >
            {t('empty.title')}
          </Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 320 }}>
            {t('empty.description')}
          </Typography>
        </Box>
      )}

      {/* Populated state */}
      {!loading && !error && events.length > 0 && (
        <TimelineList events={events} />
      )}
    </Container>
  );
}
