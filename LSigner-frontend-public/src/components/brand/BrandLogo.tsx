'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Shared brand logo component.
 *
 * Displays the LSigner logo image, title, and translated subtitle.
 * Used on auth pages (login/register) and inside the sidebar navigation.
 * Dark mode automatically inverts the logo image.
 */
export function BrandLogo({ centered = false }: { centered?: boolean }) {
  const t = useTranslations('common');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        userSelect: 'none',
        ...(centered && { justifyContent: 'center', width: '100%' }),
      }}
    >
      <Image
        src="/brand/logo-icon.png"
        alt="LSigner"
        width={36}
        height={36}
        priority
        style={{ filter: isDark ? 'brightness(0) invert(1)' : undefined }}
      />
      <Box>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: 18,
            color: 'text.primary',
            lineHeight: 1.25,
          }}
        >
          LSigner
        </Typography>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            color: 'text.secondary',
            letterSpacing: 0.5,
            lineHeight: 1,
          }}
        >
          {t('brand.subtitle')}
        </Typography>
      </Box>
    </Box>
  );
}
