'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSettingsContext } from '@/app/(app)/settings/SettingsContext';
import { useTheme, alpha, Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAuth } from '@/lib/auth/AuthContext';

interface PageMeta {
  crumbs: string[];
  titleKey: string;
}

function usePageMeta(pathname: string): PageMeta {
  const translations = useTranslations('topbar');

  const PAGE_META: Record<string, PageMeta> = { // TODO: FIX CRUMBS CAUSE THEYRE INCONSISTENT WITH NEW NAV STYLE
    '/': {
      crumbs: [translations('breadcrumbs.home')],
      titleKey: 'titles.dashboard',
    },
    '/documents': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.documents'),
      ],
      titleKey: 'titles.documents',
    },
    '/documents/sent': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.documents'),
        translations('breadcrumbs.sent'),
      ],
      titleKey: 'titles.sent',
    },
    '/documents/received': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.documents'),
        translations('breadcrumbs.received'),
      ],
      titleKey: 'titles.received',
    },
    '/documents/new': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.documents'),
      ],
      titleKey: 'titles.new_document',
    },
    '/history': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.history'),
      ],
      titleKey: 'titles.history',
    },
    '/contacts': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.contacts'),
      ],
      titleKey: 'titles.contacts',
    },
    '/security': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.security'),
      ],
      titleKey: 'titles.security',
    },
    '/settings': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.settings'),
      ],
      titleKey: 'titles.settings',
    },
    '/profile': {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.profile'),
      ],
      titleKey: 'titles.profile',
    },
  };

  const meta = PAGE_META[pathname];
  if (meta) return meta;

  if (pathname.startsWith('/documents/received/')) {
    return {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.documents'),
        translations('breadcrumbs.received'),
      ],
      titleKey: 'titles.received',
    };
  }

  if (pathname.startsWith('/documents/sent/')) {
    return {
      crumbs: [
        translations('breadcrumbs.home'),
        translations('breadcrumbs.documents'),
        translations('breadcrumbs.sent'),
      ],
      titleKey: 'titles.sent',
    };
  }

  const fallbackTitle = pathname.split('/').filter(Boolean).pop() ?? 'LSigner';
  return {
    crumbs: [translations('breadcrumbs.home')],
    titleKey: fallbackTitle,
  };
}

const calculateCrumbColor = (index: number, total: number, theme: Theme) => {
  if (index === total - 1) return theme.palette.text.primary;
  if (index === total - 2) return theme.palette.text.secondary;
  return theme.palette.text.disabled;
};

/**
 * Sticky top bar inside the main content area.
 * Shows breadcrumbs + page title on the left, notifications + user profile on the right.
 * Uses backdrop blur to blend with the content below.
 */
export function TopBar({
  onProfileClick,
}: {
  onProfileClick?: () => void;
} = {}) {
  const theme = useTheme();
  const translations = useTranslations('topbar');
  const settingsTranslations = useTranslations('settings');
  const styles = createStyles(theme);
  const pathname = usePathname() ?? '/';
  const { crumbs, titleKey } = usePageMeta(pathname);
  const { activeSection } = useSettingsContext();
  const isSettings = pathname === '/settings';

  const displayCrumbs =
    isSettings && activeSection
      ? [...crumbs, settingsTranslations(`sections.${activeSection}`)]
      : crumbs;

  const displayTitle =
    isSettings && activeSection
      ? settingsTranslations(`sections.${activeSection}`)
      : translations(titleKey);

  const auth = useAuth();
  const user = auth.user;
  const firstName = user?.name ?? '';
  const lastName = user?.last_name.split(' ')[0] ?? '';
  const initials = user
    ? `${user.name[0] ?? ''}${user.last_name[0] ?? ''}`
    : '';

  return (
    <Box component="header" sx={styles.header}>
      <Box sx={styles.toolbar}>
        {/* ── Left: breadcrumbs + page title ── */}
        <Box>
          <Box sx={styles.breadcrumbs}>
            {displayCrumbs.map((crumb: string, i: number) => {
              const crumbColor = calculateCrumbColor(
                i,
                displayCrumbs.length,
                theme,
              );
              return (
                <Box key={crumb} sx={styles.crumb}>
                  {i > 0 && <ChevronRightIcon sx={styles.crumbIcon} />}
                  <Typography
                    variant="caption"
                    sx={styles.crumbText(crumbColor)}
                  >
                    {crumb}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Typography sx={styles.title}>{displayTitle}</Typography>
        </Box>

        {/* ── Right: notifications + user ── */}
        <Box sx={styles.rightSection}>
          <Tooltip title={translations('notifications.coming_soon')}>
            <span>
              <IconButton
                size="small"
                disabled
                sx={styles.notificationsButton}
                aria-label={translations('notifications.unavailable_aria')}
              >
                <NotificationsOutlinedIcon sx={{ fontSize: 21 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={styles.userInfo}>
            <Typography sx={styles.userName}>
              {firstName} {lastName}
            </Typography>
          </Box>

          <Avatar
            sx={styles.avatar}
            onClick={onProfileClick}
            aria-label={initials}
          >
            {initials}
          </Avatar>
        </Box>
      </Box>
    </Box>
  );
}

function createStyles(theme: Theme) {
  return {
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 1100,
      bgcolor: alpha(theme.palette.background.default, 0.82),
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid',
      borderColor: 'divider',
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 3,
      height: 64,
    },
    breadcrumbs: {
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      mb: 0.3,
    },
    crumb: {
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
    },
    crumbIcon: {
      fontSize: 12,
      color: theme.palette.text.disabled,
    },
    crumbText: (color: string) => ({
      fontSize: 11,
      fontWeight: 700,
      color,
      lineHeight: 1,
    }),
    title: {
      fontWeight: 700,
      fontSize: 20,
      color: 'text.primary',
      lineHeight: 1.2,
    },
    rightSection: {
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
    },
    notificationsButton: {
      color: 'text.disabled',
      '&:hover': { color: 'text.disabled' },
    },
    userInfo: {
      textAlign: 'right',
    },
    userName: {
      fontSize: 13,
      fontWeight: 700,
      color: 'text.primary',
      lineHeight: 1.3,
    },
    avatar: {
      width: 36,
      height: 36,
      ml: 0.25,
      bgcolor: 'primary.main',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      border: '2px solid',
      borderColor: 'divider',
      transition: 'border-color 0.15s',
      '&:hover': { borderColor: 'secondary.main' },
    },
  };
}
