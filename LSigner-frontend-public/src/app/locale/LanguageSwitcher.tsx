'use client';

import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useLocaleContext, SUPPORTED_LOCALES } from './LocaleContext';
import type { Locale } from './LocaleContext';

const localeLabels: Record<Locale, string> = {
  en: 'EN',
  es: 'ES',
  ca: 'CA',
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleContext();

  const handleChange = useCallback(
    (next: Locale) => () => setLocale(next),
    [setLocale],
  );

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      {SUPPORTED_LOCALES.map((supportedLocale) => (
        <Button
          key={supportedLocale}
          type="button"
          size="small"
          onClick={handleChange(supportedLocale)}
          sx={{
            minWidth: 32,
            height: 28,
            px: 0.75,
            borderRadius: 1,
            fontWeight: locale === supportedLocale ? 700 : 500,
            fontSize: 11,
            color:
              locale === supportedLocale ? 'primary.main' : 'text.secondary',
            bgcolor:
              locale === supportedLocale ? 'action.selected' : 'transparent',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: 11,
              fontWeight: 'inherit',
              color: 'inherit',
              lineHeight: 1,
            }}
          >
            {localeLabels[supportedLocale]}
          </Typography>
        </Button>
      ))}
    </Box>
  );
}
