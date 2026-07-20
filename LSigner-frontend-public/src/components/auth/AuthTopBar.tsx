'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useAppTheme } from '@/app/theme/ThemeContext';
import { LanguageSwitcher } from '@/app/locale';

export function AuthTopBar() {
  const { mode, toggleTheme } = useAppTheme();

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <LanguageSwitcher />
      <IconButton
        type="button"
        onClick={toggleTheme}
        size="small"
        sx={{
          color: 'text.secondary',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        {mode === 'dark' ? (
          <LightModeOutlinedIcon fontSize="small" />
        ) : (
          <DarkModeOutlinedIcon fontSize="small" />
        )}
      </IconButton>
    </Box>
  );
}
