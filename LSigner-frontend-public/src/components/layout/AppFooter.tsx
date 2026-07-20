'use client';

import { useTheme, alpha, Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SIDEBAR_WIDTH } from './SideNav';

/**
 * Subtle fixed footer rendered over the main content area (not over the sidebar).
 * Shows version on the left and a tagline on the right : both as frosted-glass pills.
 * pointer-events: none so it never blocks clicks; each pill re-enables pointer-events.
 */
export function AppFooter() {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <Box component="footer" sx={styles.footer}>
      {(
        [
          process.env.NEXT_PUBLIC_APP_VERSION || 'v1.0.1',
          process.env.NEXT_PUBLIC_APP_TAGLINE || 'With love, LSigner',
        ] as const
      ).map(
        (
          text, // TODO: replace with .env variable for version and real tagline
        ) => (
          <Box key={text} sx={styles.pill}>
            <Typography sx={styles.pillText}>{text}</Typography>
          </Box>
        ),
      )}
    </Box>
  );
}

function createStyles(theme: Theme) {
  return {
    footer: {
      position: 'fixed',
      bottom: 0,
      left: SIDEBAR_WIDTH,
      right: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      px: 3,
      py: 0.75,
      pointerEvents: 'none',
      zIndex: 1000,
    },
    pill: {
      pointerEvents: 'auto',
      bgcolor: alpha(theme.palette.background.default, 0.82),
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid',
      borderColor: 'divider',
      px: 1.5,
      py: 0.4,
      borderRadius: 10,
    },
    pillText: {
      fontSize: 11,
      color: 'text.secondary',
      lineHeight: 1,
    },
  };
}
