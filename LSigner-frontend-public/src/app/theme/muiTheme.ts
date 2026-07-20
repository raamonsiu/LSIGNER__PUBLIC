import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

// === Custom palette type extensions ==========================================
declare module '@mui/material/styles' {
  interface Palette {
    /** Status chip / label color tokens */
    chip: {
      successText: string;
      successBg: string;
      waitText: string;
      waitBg: string;
      errorText: string;
      errorBg: string;
    };
    /** Navigation item & icon tint tokens */
    nav: {
      activeText: string;
      activeBg: string;
      iconColor: string;
      iconBg: string;
    };
    /** Breadcrumb color tokens */
    crumb: {
      inactive: string;
      current: string;
    };
  }
  interface PaletteOptions {
    chip?: Palette['chip'];
    nav?: Palette['nav'];
    crumb?: Palette['crumb'];
  }
}

/**
 * Raw palette values, should match the CSS vars in globals.css.
 * Centralizing here avoids duplicating literals in both systems.
 */
const raw = {
  // Brand primary : navy
  navyBrand: '#03045e', // primary.main in light / security widget bg
  navyMuted: '#e5e5ef', // icon bg light / success chip bg light
  navyDeep: '#151a35', // breadcrumb current light / contrastText on cream
  navyGray: '#60647a', // breadcrumb inactive
  navyDark: '#02033a', // navyBrand darkened (hover)
  // Brand primary : dark mode
  creamWhite: '#f9fafb', // primary.main in dark
  // Icon bg dark
  iconBgDark: '#242a39', // icon bg dark / success chip bg dark
  // Secondary : amber
  secondary400: '#fbbf24',
  secondary500: '#f59e0b',
  secondary600: '#d97706',
  secondary700: '#b45309',
  // Light surfaces
  bgLight: '#f9f9f9',
  surfaceLight1: '#ffffff',
  surfaceLight2: '#f3f3f3',
  // Dark surfaces
  bgDark: '#070e1d',
  surfaceDark1: '#0c1322',
  surfaceDark2: '#1e293b',
  surfaceDark3: '#334155',
  // Text : light mode
  textLightPrimary: '#151a35',
  textLightSecondary: '#5a6175',
  textLightDisabled: '#9ca3af',
  // Text : dark mode
  textDarkPrimary: '#f9fafb',
  textDarkSecondary: '#9ca3af',
  textDarkDisabled: '#4b5563',
  // Border
  borderLight: '#e5e7eb',
  borderDark: '#1e293b',
  // Chip : light
  chipWaitText: '#745c00',
  chipWaitBg: '#fff7de',
  chipErrText: '#93000a',
  chipErrBg: '#ffdad6',
  // Chip : dark
  chipWaitTextDk: '#9ca3af',
  chipWaitBgDk: '#151b2b',
  chipErrTextDk: '#f87171',
  chipErrBgDk: '#231521',
  // Status : light
  successLight: '#10b981',
  warningLight: '#f59e0b',
  errorLight: '#ef4444',
  infoLight: '#3b82f6',
  // Status : dark
  successDark: '#34d399',
  warningDark: '#fbbf24',
  errorDark: '#f87171',
  infoDark: '#60a5fa',
} as const;

/**
 * Creates the MUI theme for the specified mode.
 * Colors should stay in sync with the CSS custom properties in globals.css.
 *
 * @param mode - 'dark' | 'light'
 */
export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        // Light: navyBrand (#03045e) : dark: creamWhite (#f9fafb)
        main: isDark ? raw.creamWhite : raw.navyBrand,
        light: isDark ? raw.creamWhite : raw.navyMuted,
        // Mode-dependent: in light, hover darkens to navyDark; in dark, SecurityWidget uses navyBrand
        dark: isDark ? raw.navyBrand : raw.navyDark,
        contrastText: isDark ? raw.navyDeep : '#ffffff',
      },
      secondary: {
        main: isDark ? raw.secondary400 : raw.secondary500,
        dark: raw.secondary700,
        light: raw.secondary400,
        contrastText: raw.navyDeep,
      },
      action: {
        hover: isDark ? 'rgba(249, 250, 251, 0.08)' : 'rgba(3, 4, 94, 0.07)',
        selected: isDark ? raw.iconBgDark : raw.navyBrand,
      },
      background: {
        default: isDark ? raw.bgDark : raw.bgLight,
        paper: isDark ? raw.surfaceDark1 : raw.surfaceLight2,
      },
      text: {
        primary: isDark ? raw.textDarkPrimary : raw.textLightPrimary,
        secondary: isDark ? raw.textDarkSecondary : raw.textLightSecondary,
        disabled: isDark ? raw.textDarkDisabled : raw.textLightDisabled,
      },
      divider: isDark ? raw.borderDark : raw.borderLight,
      error: { main: isDark ? raw.errorDark : raw.errorLight },
      success: { main: isDark ? raw.successDark : raw.successLight },
      warning: { main: isDark ? raw.warningDark : raw.warningLight },
      info: { main: isDark ? raw.infoDark : raw.infoLight },

      // == Custom semantic tokens ================================
      chip: {
        successText: isDark ? raw.creamWhite : raw.navyBrand,
        successBg: isDark ? raw.iconBgDark : raw.navyMuted,
        waitText: isDark ? raw.chipWaitTextDk : raw.chipWaitText,
        waitBg: isDark ? raw.chipWaitBgDk : raw.chipWaitBg,
        errorText: isDark ? raw.chipErrTextDk : raw.chipErrText,
        errorBg: isDark ? raw.chipErrBgDk : raw.chipErrBg,
      },
      nav: {
        activeText: isDark ? raw.creamWhite : '#ffffff',
        activeBg: isDark ? raw.iconBgDark : raw.navyBrand,
        iconColor: isDark ? raw.creamWhite : raw.navyBrand,
        iconBg: isDark ? raw.iconBgDark : raw.navyMuted,
      },
      crumb: {
        inactive: raw.navyGray,
        current: isDark ? raw.creamWhite : raw.navyDeep,
      },
    },

    shape: { borderRadius: 8 },

    typography: { // Comas are for fallback fonts, each one is another level of fallback
      fontFamily:
        "var(--font-mplusu), 'DM Sans', 'Nunito', 'Segoe UI', system-ui, sans-serif",
    },

    components: {
      // Removes the default background image from Paper, since we use CSS vars for that.
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      // Buttons: no elevation, explicit hover bg+text for contained variants.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => {
            if (
              ownerState.variant === 'contained' &&
              ownerState.color === 'primary'
            ) {
              return isDark
                ? {
                  // Cream bg -> navy on hover, text flips to cream
                  '&:hover': {
                    backgroundColor: raw.navyMuted,
                    color: raw.navyDark,
                  },
                }
                : {
                  // Navy bg -> darker navy on hover, text stays white
                  '&:hover': {
                    backgroundColor: raw.navyDark,
                    color: '#ffffff',
                  },
                };
            }
            if (
              ownerState.variant === 'contained' &&
              ownerState.color === 'secondary'
            ) {
              return {
                color: raw.navyDeep,
                '&:hover': {
                  backgroundColor: raw.secondary600,
                  color: raw.navyDeep,
                },
              };
            }
            return {};
          },
        },
      },
      // Inputs aligned with the CSS vars
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: 'var(--input-bg)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--input-border)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--border-strong)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--input-focus)',
            },
          },
          input: {
            color: 'var(--input-text)',
            '&::placeholder': { color: 'var(--input-placeholder)' },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: 'var(--text-secondary)',
            '&.Mui-focused': { color: 'var(--input-focus)' },
          },
        },
      },
    },
  });
}
