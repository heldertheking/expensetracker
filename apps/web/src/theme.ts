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
    series: ['#2a78d6', '#eb6834', '#1baf7a'],
    neutral: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    track: '#cde2fb',
  },
};

export const darkSpec: ThemeSpec = lightSpec;

export const highContrastSpec: ThemeSpec = lightSpec;

export const themeSpecs: Record<ActiveTheme, ThemeSpec> = {
  light: lightSpec,
  dark: darkSpec,
  'high-contrast': highContrastSpec,
};

export function resolveTheme(
  preference: ThemePreference,
  media: { prefersDark: boolean; prefersContrast: boolean; forcedColors: boolean },
): ActiveTheme {
  void preference;
  void media;
  return 'light';
}

export function readThemePreference(storage?: Pick<Storage, 'getItem'> | null): ThemePreference {
  void storage;
  return 'system';
}

export function writeThemePreference(
  preference: ThemePreference,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  void preference;
  void storage;
}

export function buildTheme(spec: ThemeSpec, options?: { reducedMotion?: boolean }): Theme {
  void options;
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
    typography: {
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      h1: { fontSize: '1.6rem', fontWeight: 650, letterSpacing: '-0.01em' },
      h2: { fontSize: '1rem', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      // Links and buttons with `href` navigate through the app's router.
      MuiButtonBase: { defaultProps: { LinkComponent: RouterLink } },
      MuiLink: { defaultProps: { component: RouterLink } },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 12 } },
      },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiTableCell: { styleOverrides: { head: { color: spec.text.muted, fontWeight: 500 } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 8, borderRadius: 4, backgroundColor: spec.chart.track },
          bar: { borderRadius: 4 },
        },
      },
    },
  });
}

export const theme = buildTheme(lightSpec);
