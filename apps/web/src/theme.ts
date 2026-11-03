import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { RouterLink } from './router';

/** Colors the charts use beyond the standard MUI palette. */
export interface ChartColors {
  /** Categorical series colors, used in this fixed order (validated as a set). */
  series: readonly [string, string, string];
  /** Optional stroke dash patterns so line series stay distinguishable without color alone. */
  seriesDash?: readonly [string, string, string];
  /** Whether line charts should render point markers on each series. */
  showMarks?: boolean;
  /** For a series that should recede, e.g. untagged spending. */
  neutral: string;
  grid: string;
  axis: string;
  /** Unfilled part of a budget meter: a light step of the primary ramp. */
  track: string;
}

export const THEME_STORAGE_KEY = 'expensetracker.theme';

export const THEME_PREFERENCES = ['system', 'light', 'dark', 'high-contrast'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const ACTIVE_THEMES = ['light', 'dark', 'high-contrast'] as const;
export type ActiveTheme = (typeof ACTIVE_THEMES)[number];

export interface ThemeMediaState {
  prefersDark: boolean;
  prefersContrast: boolean;
  forcedColors: boolean;
  reducedMotion?: boolean;
}

declare module '@mui/material/styles' {
  interface Theme {
    chart: ChartColors;
  }
  interface ThemeOptions {
    chart?: ChartColors;
  }
}

/**
 * Everything that differs between themes. Further themes (dark, high contrast) are new specs
 * passed to `buildTheme`; components only read roles from the theme, never raw colors.
 */
export interface ThemeSpec {
  mode: 'light' | 'dark';
  highContrast?: boolean;
  primary: { main: string; dark: string; contrastText: string };
  surfaces: { page: string; paper: string };
  text: { primary: string; secondary: string; muted: string };
  status: { good: string; warning: string; critical: string };
  divider: string;
  focusRing?: string;
  chart: ChartColors;
}

/** Light theme with the validated categorical palette (slots 1-3) for chart series. */
export const lightSpec: ThemeSpec = {
  mode: 'light',
  primary: { main: '#256abf', dark: '#184f95', contrastText: '#ffffff' },
  surfaces: { page: '#f6f6f3', paper: '#fcfcfb' },
  text: { primary: '#0b0b0b', secondary: '#52514e', muted: '#6d6b66' },
  status: { good: '#006300', warning: '#fab219', critical: '#d03b3b' },
  divider: 'rgba(11, 11, 11, 0.1)',
  chart: {
    series: ['#256abf', '#c44b19', '#117c54'],
    neutral: '#6d6b66',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    track: '#cde2fb',
  },
};

/** Dark theme with brightened categorical series for dark surfaces. */
export const darkSpec: ThemeSpec = {
  mode: 'dark',
  primary: { main: '#66a8ff', dark: '#3b88f5', contrastText: '#08101d' },
  surfaces: { page: '#111315', paper: '#181b1f' },
  text: { primary: '#f3f4f6', secondary: '#b6bcc6', muted: '#949ca8' },
  status: { good: '#4fd18b', warning: '#f6bd41', critical: '#ff7070' },
  divider: 'rgba(243, 244, 246, 0.14)',
  chart: {
    series: ['#66a8ff', '#ff8b57', '#3dd69d'],
    neutral: '#949ca8',
    grid: '#2b3038',
    axis: '#586170',
    track: '#25354d',
  },
};

/**
 * WCAG AAA high-contrast theme: >= 7:1 text and accent contrast on pure black surfaces, explicit
 * component borders, underlined links, a 3px focus ring, and dashed/marked chart lines.
 */
export const highContrastSpec: ThemeSpec = {
  mode: 'dark',
  highContrast: true,
  primary: { main: '#5ce1ff', dark: '#26c6eb', contrastText: '#000000' },
  surfaces: { page: '#000000', paper: '#000000' },
  text: { primary: '#ffffff', secondary: '#f0f0f0', muted: '#d9d9d9' },
  status: { good: '#5cff8d', warning: '#ffe64d', critical: '#ff8080' },
  divider: '#ffffff',
  focusRing: '#ffe64d',
  chart: {
    series: ['#5ce1ff', '#ffb340', '#5cff8d'],
    seriesDash: ['none', '8 4', '2 4'],
    showMarks: true,
    neutral: '#d9d9d9',
    grid: '#595959',
    axis: '#ffffff',
    track: '#333333',
  },
};

export const themeSpecs: Record<ActiveTheme, ThemeSpec> = {
  light: lightSpec,
  dark: darkSpec,
  'high-contrast': highContrastSpec,
};

/**
 * Pure resolution from the user's preference and current OS media queries to an active theme.
 * High-contrast signals (`prefers-contrast: more` or `forced-colors: active`) take precedence when
 * following the system.
 */
export function resolveTheme(
  preference: ThemePreference,
  media: { prefersDark: boolean; prefersContrast: boolean; forcedColors: boolean },
): ActiveTheme {
  if (preference !== 'system') {
    return preference;
  }
  if (media.prefersContrast || media.forcedColors) {
    return 'high-contrast';
  }
  return media.prefersDark ? 'dark' : 'light';
}

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return (
    value !== null &&
    value !== undefined &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/** Reads the persisted theme preference, falling back to `'system'` on invalid data or storage errors. */
export function readThemePreference(
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.localStorage,
): ThemePreference {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

/** Persists the user's theme preference, ignoring storage errors (private browsing, quota, etc.). */
export function writeThemePreference(
  preference: ThemePreference,
  storage: Pick<Storage, 'setItem'> | null | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage errors and keep the in-memory preference active for the session.
  }
}

export function buildTheme(spec: ThemeSpec, options?: { reducedMotion?: boolean }): Theme {
  const hc = Boolean(spec.highContrast);
  const focusRing = spec.focusRing ?? spec.primary.main;
  const focusVisibleStyle = hc
    ? { outline: `3px solid ${focusRing}`, outlineOffset: '2px' }
    : { outline: `2px solid ${focusRing}`, outlineOffset: '2px' };

  return createTheme({
    palette: {
      mode: spec.mode,
      primary: spec.primary,
      success: { main: spec.status.good },
      warning: { main: spec.status.warning },
      error: { main: spec.status.critical },
      background: { default: spec.surfaces.page, paper: spec.surfaces.paper },
      text: {
        primary: spec.text.primary,
        secondary: spec.text.secondary,
        disabled: spec.text.muted,
      },
      divider: spec.divider,
    },
    chart: spec.chart,
    shape: { borderRadius: 10 },
    ...(options?.reducedMotion && {
      transitions: { create: () => 'none' },
    }),
    typography: {
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      h1: { fontSize: '1.6rem', fontWeight: 650, letterSpacing: '-0.01em' },
      h2: { fontSize: '1rem', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: hc ? 600 : 500 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*:focus-visible': focusVisibleStyle,
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
              scrollBehavior: 'auto !important',
            },
          },
        },
      },
      // Links and buttons with `href` navigate through the app's router.
      MuiButtonBase: {
        defaultProps: { LinkComponent: RouterLink, disableRipple: hc || options?.reducedMotion },
        styleOverrides: {
          root: {
            '&.Mui-focusVisible': focusVisibleStyle,
          },
        },
      },
      MuiLink: {
        defaultProps: { component: RouterLink, underline: hc ? 'always' : 'hover' },
        ...(hc && {
          styleOverrides: {
            root: {
              textDecorationThickness: '2px',
              textUnderlineOffset: '0.18em',
              fontWeight: 600,
            },
          },
        }),
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderRadius: 12,
            ...(hc && { borderWidth: 2, borderColor: spec.divider }),
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        ...(hc && {
          styleOverrides: {
            root: {
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: 'currentColor',
            },
            contained: {
              borderColor: spec.divider,
            },
          },
        }),
      },
      MuiIconButton: {
        ...(hc && {
          styleOverrides: {
            root: {
              border: `2px solid ${spec.divider}`,
            },
          },
        }),
      },
      MuiOutlinedInput: {
        ...(hc && {
          styleOverrides: {
            notchedOutline: {
              borderWidth: 2,
              borderColor: spec.divider,
            },
          },
        }),
      },
      MuiToggleButton: {
        ...(hc && {
          styleOverrides: {
            root: {
              borderWidth: 2,
              borderColor: spec.divider,
              color: spec.text.primary,
              '&.Mui-selected': {
                borderWidth: 2,
                borderColor: spec.primary.main,
                fontWeight: 700,
              },
            },
          },
        }),
      },
      MuiChip: {
        ...(hc && {
          styleOverrides: {
            root: {
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: spec.divider,
            },
          },
        }),
      },
      MuiAlert: {
        ...(hc && {
          styleOverrides: {
            root: {
              border: `2px solid ${spec.divider}`,
            },
          },
        }),
      },
      MuiMenu: {
        ...(hc && {
          styleOverrides: {
            paper: {
              border: `2px solid ${spec.divider}`,
            },
          },
        }),
      },
      MuiDialog: {
        ...(hc && {
          styleOverrides: {
            paper: {
              border: `2px solid ${spec.divider}`,
            },
          },
        }),
      },
      MuiTableCell: {
        styleOverrides: {
          head: { color: spec.text.muted, fontWeight: hc ? 600 : 500 },
          ...(hc && { root: { borderBottomWidth: 2, borderBottomColor: spec.divider } }),
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: hc ? 10 : 8,
            borderRadius: 4,
            backgroundColor: spec.chart.track,
            ...(hc && { border: `1px solid ${spec.divider}` }),
          },
          bar: { borderRadius: 4 },
        },
      },
    },
  });
}

export const themes: Record<ActiveTheme, Theme> = {
  light: buildTheme(lightSpec),
  dark: buildTheme(darkSpec),
  'high-contrast': buildTheme(highContrastSpec),
};

export const theme = themes.light;
