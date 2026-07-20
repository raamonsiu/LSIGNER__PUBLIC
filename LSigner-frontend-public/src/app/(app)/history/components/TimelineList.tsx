'use client';

// TODO: Facotr stylesz
import Box from '@mui/material/Box';
import { TimelineItem } from './TimelineItem';
import type { TimelineItem as TimelineItemType } from '@/lib/api/endpoints/types';

interface TimelineListProps {
  events: TimelineItemType[];
}

export function TimelineList({ events }: TimelineListProps) {
  if (events.length === 0) return <Box />;

  return (
    <Box
      role="list"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        py: 2,
        px: { xs: 0, md: 0 },
        // Centered vertical line (desktop) / left-aligned line (mobile)
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: 'divider',
          left: { xs: 16, md: '50%' },
          transform: { xs: 'none', md: 'translateX(-50%)' },
        },
      }}
    >
      {events.map((event, index) => (
        <Box
          key={event.id}
          sx={{
            mb: index < events.length - 1 ? 3 : 0,
            contentVisibility: 'auto',
            display: { xs: 'block', md: 'flex' },
            flexDirection: { xs: undefined, md: 'column' },
            width: '100%',
          }}
        >
          <TimelineItem
            direction={event.direction}
            event={event}
            isLast={index === events.length - 1}
          />
        </Box>
      ))}
    </Box>
  );
}
