'use client';

// TODO: Factor styles
import { type ReactNode } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

interface SettingsSectionProps {
  id: string;
  title: string;
  children?: ReactNode;
}

export function SettingsSection({ id, title, children }: SettingsSectionProps) {
  const theme = useTheme();

  return (
    <Box
      id={id}
      sx={{
        scrollMarginTop: 80,
        py: 4,
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          fontSize: 22,
          color: 'text.primary',
          mb: 3,
        }}
      >
        {title}
      </Typography>

      {children || (
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.4),
            p: 4,
            minHeight: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography sx={{ color: 'text.disabled', fontSize: 14 }}>
            {title} — content coming soon
          </Typography>
        </Box>
      )}

      <Divider sx={{ mt: 4, mb: 0 }} />
    </Box>
  );
}
