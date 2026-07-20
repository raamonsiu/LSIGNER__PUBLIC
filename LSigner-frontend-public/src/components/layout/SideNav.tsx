'use client'; // This component is client rendered because it uses hooks and needs to respond to navigation changes for active link highlighting.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme, type Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useWizard } from '@/components/providers/SendDocumentWizardProvider';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import OutboxIcon from '@mui/icons-material/Outbox';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import HistoryIcon from '@mui/icons-material/History';
import ContactsIcon from '@mui/icons-material/Contacts';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';

export const SIDEBAR_WIDTH = 256;

const NAV_ITEM_DEFS = [ // TODO: Remember to change crumbs
  { href: '/', key: 'nav.home', icon: HomeRoundedIcon, disabled: false },
  {
    href: '/documents/sent',
    key: 'nav.sent',
    icon: OutboxIcon,
    disabled: false,
  },
  {
    href: '/documents/received',
    key: 'nav.received',
    icon: MoveToInboxIcon,
    disabled: false,
  },
  { href: '/history', key: 'nav.history', icon: HistoryIcon, disabled: false },
  {
    href: '/contacts',
    key: 'nav.contacts',
    icon: ContactsIcon,
    disabled: false,
  },
  {
    href: '/security',
    key: 'nav.security',
    icon: VerifiedUserOutlinedIcon,
    disabled: true,
  },
  {
    href: '/settings',
    key: 'nav.settings',
    icon: SettingsIcon,
    disabled: false,
  },
] as const;

type SideNavStyles = ReturnType<typeof createStyles>;

function NavLinks({
  pathname,
  styles,
  translations,
}: {
  pathname: string;
  styles: SideNavStyles;
  translations: (key: string) => string;
}) {
  return (
    <Box component="nav" sx={styles.nav}>
      {NAV_ITEM_DEFS.map(({ href, key, icon: Icon, disabled }) => {
        const isActive = pathname === href;

        if (disabled) {
          return (
            <Tooltip
              key={href}
              title={translations('common.coming_soon')}
              arrow
            >
              <Box
                sx={{
                  ...styles.navItem,
                  color: 'text.disabled',
                  cursor: 'default',
                }}
              >
                <Icon sx={styles.navIcon} />
                {translations(key)}
              </Box>
            </Tooltip>
          );
        }

        return (
          <Box
            key={href}
            component={Link}
            href={href}
            sx={{
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : styles.navItemInactive),
            }}
          >
            <Icon sx={styles.navIcon} />
            {translations(key)}
          </Box>
        );
      })}
    </Box>
  );
}

function CTA({
  styles,
  translations,
}: {
  styles: SideNavStyles;
  translations: (key: string) => string;
}) {
  const { openWizard } = useWizard();

  return (
    <Box sx={styles.ctaWrapper}>
      <Button
        variant="contained"
        color="primary"
        fullWidth
        startIcon={<AddIcon />}
        sx={styles.ctaButton}
        onClick={openWizard}
      >
        {translations('nav.new_document')}
      </Button>
    </Box>
  );
}

/**
 * Permanent left sidebar navigation.
 * Contains the brand logo, nav links, and a "New Document" CTA at the bottom.
 */
export function SideNav() {
  const pathname = usePathname() ?? '/';
  const theme = useTheme();
  const translations = useTranslations();
  const styles = createStyles(theme);

  return (
    <Box component="aside" sx={styles.sidebar}>
      <Box component={Link} href="/" sx={styles.brandLink}>
        <BrandLogo />
      </Box>
      <NavLinks
        pathname={pathname}
        styles={styles}
        translations={translations}
      />
      <CTA styles={styles} translations={translations} />
    </Box>
  );
}

function createStyles(theme: Theme) {
  return {
    sidebar: {
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      width: SIDEBAR_WIDTH,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper',
      borderRight: '1px solid',
      borderColor: 'divider',
      zIndex: 1200,
      p: 2,
      overflowY: 'auto',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      scrollbarWidth: 'none',
    },
    brandLink: {
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      mb: 4,
      px: 0.5,
      textDecoration: 'none',
      userSelect: 'none',
      flexShrink: 0,
    },
    nav: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      px: 1.5,
      py: 0.9,
      borderRadius: 1,
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 600,
      transition:
        'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        transform: 'translateX(4px)',
      },
    },
    navItemActive: {
      color: theme.palette.nav.activeText,
      bgcolor: theme.palette.nav.activeBg,
      '&:hover': {
        transform: 'translateX(4px)',
        bgcolor: theme.palette.nav.activeBg,
        color: theme.palette.nav.activeText,
      },
    },
    navItemInactive: {
      color: theme.palette.text.secondary,
      bgcolor: 'transparent',
      '&:hover': {
        transform: 'translateX(4px)',
        bgcolor: theme.palette.action.hover,
        color: theme.palette.text.primary,
      },
    },
    navIcon: {
      fontSize: 20,
      flexShrink: 0,
    },
    ctaWrapper: {
      mt: 2,
    },
    ctaButton: {
      py: 1.25,
      borderRadius: 2,
      fontWeight: 700,
      fontSize: 14,
    },
  };
}
