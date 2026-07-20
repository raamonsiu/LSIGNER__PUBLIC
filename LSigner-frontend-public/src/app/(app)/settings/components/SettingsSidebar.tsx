'use client';

// TODO: FActor styles
import { useTheme, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useSettingsContext, type SettingsSection } from '../SettingsContext';

const SECTIONS: { id: SettingsSection }[] = [
  { id: 'user' },
  { id: 'platform' },
  { id: 'docs' },
  { id: 'cookies' },
  { id: 'danger-zone' },
];

export function SettingsSidebar() {
  const theme = useTheme();
  const t = useTranslations('settings');
  const { activeSection } = useSettingsContext();

  const handleClick = (id: SettingsSection) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 80,
        width: 200,
        flexShrink: 0,
        alignSelf: 'flex-start',
        mr: 2,
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'text.disabled',
          mb: 1.5,
        }}
      >
        {t('sidebar.title')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {SECTIONS.map(({ id }) => {
          const isActive = activeSection === id;
          const label = t(`sections.${id}`);

          return (
            <Box
              key={id}
              onClick={() => handleClick(id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'primary.main' : 'text.secondary',
                bgcolor: isActive
                  ? alpha(theme.palette.primary.main, 0.08)
                  : 'transparent',
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: isActive
                    ? alpha(theme.palette.primary.main, 0.12)
                    : alpha(theme.palette.text.primary, 0.04),
                },
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  border: isActive ? 'none' : '1px solid',
                  borderColor: 'text.disabled',
                  flexShrink: 0,
                }}
              />
              {label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
