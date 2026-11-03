import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import {
  buildTheme,
  readThemePreference,
  resolveTheme,
  themeSpecs,
  writeThemePreference,
} from './theme';
import type { ActiveTheme, ThemeMediaState, ThemePreference } from './theme';

export interface ThemePreferenceContextValue {
  preference: ThemePreference;
  activeTheme: ActiveTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  preference: 'system',
  activeTheme: 'light',
  setPreference: () => {},
});

const MEDIA_QUERIES = {
  prefersDark: '(prefers-color-scheme: dark)',
  prefersContrast: '(prefers-contrast: more)',
  forcedColors: '(forced-colors: active)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

function queryMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return Boolean(window.matchMedia(query)?.matches);
}

function readMediaState(): Required<ThemeMediaState> {
  return {
    prefersDark: queryMatches(MEDIA_QUERIES.prefersDark),
    prefersContrast: queryMatches(MEDIA_QUERIES.prefersContrast),
    forcedColors: queryMatches(MEDIA_QUERIES.forcedColors),
    reducedMotion: queryMatches(MEDIA_QUERIES.reducedMotion),
  };
}

function applyDocumentTheme(activeTheme: ActiveTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = activeTheme;
  document.documentElement.style.colorScheme = themeSpecs[activeTheme].mode;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference());
  const [media, setMedia] = useState<Required<ThemeMediaState>>(() => readMediaState());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const lists = Object.values(MEDIA_QUERIES)
      .map((query) => window.matchMedia(query))
      .filter((mql): mql is MediaQueryList => Boolean(mql));

    const handleChange = () => {
      setMedia(readMediaState());
    };

    for (const mql of lists) {
      mql.addEventListener('change', handleChange);
    }
    return () => {
      for (const mql of lists) {
        mql.removeEventListener('change', handleChange);
      }
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeThemePreference(next);
  }, []);

  const activeTheme = resolveTheme(preference, media);
  applyDocumentTheme(activeTheme);

  useEffect(() => {
    applyDocumentTheme(activeTheme);
  }, [activeTheme]);

  const muiTheme = useMemo(
    () => buildTheme(themeSpecs[activeTheme], { reducedMotion: media.reducedMotion }),
    [activeTheme, media.reducedMotion],
  );

  const contextValue = useMemo(
    () => ({ preference, activeTheme, setPreference }),
    [preference, activeTheme, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={contextValue}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  return useContext(ThemePreferenceContext);
}
