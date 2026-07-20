'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import { useLocaleContext } from '@/app/locale/LocaleContext';
import { useAppTheme } from '@/app/theme/ThemeContext';

// == Constants =================================================================

const REDUCED_MOTION_KEY = 'platform.reducedMotion';
const NOTIFICATIONS_KEY = 'platform.notifications';

// == Helpers ===================================================================

function resolveReducedMotionDefault(): boolean {
  const saved = localStorage.getItem(REDUCED_MOTION_KEY);
  if (saved === 'on') return true;
  if (saved === 'off') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// == Styles ====================================================================

function createStyles() {
  return {
    card: {
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      mb: 2,
    } as const,
    cardContent: {
      p: '24px !important',
    } as const,
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: 'text.secondary',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      mb: 1.5,
    } as const,
    settingRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: 1.5,
      '&:last-child': { mb: 0 },
    } as const,
    settingLabel: {
      fontSize: 14,
      fontWeight: 500,
      color: 'text.primary',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    } as const,
    helpIcon: {
      fontSize: 16,
      color: 'text.disabled',
      cursor: 'help',
    } as const,
  };
}

// == Component =================================================================

export function PlatformSettingsSection() {
  const t = useTranslations('settings.platform');
  const tCommon = useTranslations('common');
  const { locale, setLocale } = useLocaleContext();
  const { mode, toggleTheme } = useAppTheme();
  const styles = createStyles();

  // == Notifications state ==============================================

  const [notifications, setNotifications] = useState<boolean>(
    () => localStorage.getItem(NOTIFICATIONS_KEY) === 'on',
  );

  const handleNotifications = useCallback(
    (_e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setNotifications(checked);
      localStorage.setItem(NOTIFICATIONS_KEY, checked ? 'on' : 'off');
    },
    [],
  );

  // == Reduced motion state =============================================

  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    resolveReducedMotionDefault(),
  );

  // Apply reduced-motion attribute on mount when active by default
  useEffect(() => {
    if (resolveReducedMotionDefault()) {
      document.documentElement.setAttribute('data-reduce-motion', '');
    }
  }, []);

  const handleReducedMotion = useCallback(
    (_e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setReducedMotion(checked);
      localStorage.setItem(REDUCED_MOTION_KEY, checked ? 'on' : 'off');
      if (checked) {
        document.documentElement.setAttribute('data-reduce-motion', '');
      } else {
        document.documentElement.removeAttribute('data-reduce-motion');
      }
    },
    [],
  );

  // == Language options =================================================

  const languageOptions: { value: string; label: string }[] = [
    { value: 'en', label: tCommon('language.en') },
    { value: 'es', label: tCommon('language.es') },
    { value: 'ca', label: tCommon('language.ca') },
  ];

  // == Render ===========================================================

  return (
    <Box>
      {/* == Appearance Card ========================================= */}
      <Card elevation={0} sx={styles.card}>
        <CardContent sx={styles.cardContent}>
          <Typography sx={styles.sectionTitle}>{t('appearance')}</Typography>

          {/* Language selector */}
          <Box sx={styles.settingRow}>
            <Typography sx={styles.settingLabel}>{t('language')}</Typography>
            <ToggleButtonGroup
              value={locale}
              exclusive
              onChange={(_e, value) => {
                if (value) setLocale(value);
              }}
              size="small"
              aria-label={t('language_aria')}
            >
              {languageOptions.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Theme toggle */}
          <Box sx={styles.settingRow}>
            <Typography sx={styles.settingLabel}>
              {mode === 'dark' ? (
                <DarkModeIcon fontSize="small" />
              ) : (
                <LightModeIcon fontSize="small" />
              )}
              {tCommon('theme.light')} / {tCommon('theme.dark')}
            </Typography>
            <Switch
              checked={mode === 'dark'}
              onChange={toggleTheme}
              aria-label={t('theme_aria')}
            />
          </Box>
        </CardContent>
      </Card>

      {/* == Preferences Card ========================================== */}
      <Card elevation={0} sx={styles.card}>
        <CardContent sx={styles.cardContent}>
          <Typography sx={styles.sectionTitle}>{t('preferences')}</Typography>

          {/* Notifications toggle */}
          <Box sx={styles.settingRow}>
            <Typography sx={styles.settingLabel}>
              <NotificationsNoneIcon fontSize="small" />
              {t('notifications')}
              <Tooltip
                title={t('notifications_tooltip')}
                placement="right"
                arrow
              >
                <HelpCenterIcon sx={styles.helpIcon} />
              </Tooltip>
            </Typography>
            <Switch
              checked={notifications}
              onChange={handleNotifications}
              aria-label={t('notifications_aria')}
            />
          </Box>

          {/* Reduced motion toggle */}
          <Box sx={styles.settingRow}>
            <Typography sx={styles.settingLabel}>
              <AccessibilityNewIcon fontSize="small" />
              {t('reduced_motion')}
              <Tooltip
                title={t('reduced_motion_tooltip')}
                placement="right"
                arrow
              >
                <HelpCenterIcon sx={styles.helpIcon} />
              </Tooltip>
            </Typography>
            <Switch
              checked={reducedMotion}
              onChange={handleReducedMotion}
              aria-label={t('reduced_motion_aria')}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
