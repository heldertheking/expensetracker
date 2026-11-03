import { describe, expect, it } from 'vitest';
import {
  ACTIVE_THEMES,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  buildTheme,
  darkSpec,
  highContrastSpec,
  lightSpec,
  readThemePreference,
  resolveTheme,
  themeSpecs,
  writeThemePreference,
} from '../src/theme';

/** Parses `#rrggbb` into linear-light sRGB channels and computes WCAG 2.1 relative luminance. */
function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) {
    throw new Error(`Expected #rrggbb hex color, got ${hex}`);
  }
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.1 contrast ratio between two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('resolveTheme', () => {
  it('resolves system preference from prefers-color-scheme, prefers-contrast and forced-colors', () => {
    expect(
      resolveTheme('system', { prefersDark: false, prefersContrast: false, forcedColors: false }),
    ).toBe('light');
    expect(
      resolveTheme('system', { prefersDark: true, prefersContrast: false, forcedColors: false }),
    ).toBe('dark');
    expect(
      resolveTheme('system', { prefersDark: false, prefersContrast: true, forcedColors: false }),
    ).toBe('high-contrast');
    expect(
      resolveTheme('system', { prefersDark: true, prefersContrast: true, forcedColors: false }),
    ).toBe('high-contrast');
    expect(
      resolveTheme('system', { prefersDark: false, prefersContrast: false, forcedColors: true }),
    ).toBe('high-contrast');
    expect(
      resolveTheme('system', { prefersDark: true, prefersContrast: false, forcedColors: true }),
    ).toBe('high-contrast');
  });

  it('keeps an explicit theme choice regardless of system media queries', () => {
    const allSignals = { prefersDark: true, prefersContrast: true, forcedColors: true };
    const noSignals = { prefersDark: false, prefersContrast: false, forcedColors: false };

    for (const active of ACTIVE_THEMES) {
      expect(resolveTheme(active, allSignals)).toBe(active);
      expect(resolveTheme(active, noSignals)).toBe(active);
    }
  });
});

describe('theme preference persistence', () => {
  it('reads valid stored preferences and falls back to system for missing or unknown values', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    expect(readThemePreference(storage)).toBe('system');

    for (const pref of THEME_PREFERENCES) {
      writeThemePreference(pref, storage);
      expect(store.get(THEME_STORAGE_KEY)).toBe(pref);
      expect(readThemePreference(storage)).toBe(pref);
    }

    store.set(THEME_STORAGE_KEY, 'neon-cyberpunk');
    expect(readThemePreference(storage)).toBe('system');
  });

  it('catches storage errors and missing storage without throwing', () => {
    const throwingStorage = {
      getItem: () => {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
    };

    expect(readThemePreference(throwingStorage)).toBe('system');
    expect(readThemePreference(null)).toBe('system');
    expect(() => writeThemePreference('dark', throwingStorage)).not.toThrow();
    expect(() => writeThemePreference('dark', null)).not.toThrow();
  });
});

describe('theme specs and WCAG contrast ratios', () => {
  it('exposes distinct light, dark and high-contrast specs', () => {
    expect(themeSpecs.light).toBe(lightSpec);
    expect(themeSpecs.dark).toBe(darkSpec);
    expect(themeSpecs['high-contrast']).toBe(highContrastSpec);
    expect(lightSpec.mode).toBe('light');
    expect(darkSpec.mode).toBe('dark');
    expect(highContrastSpec.mode).toBe('dark');
    expect(highContrastSpec.highContrast).toBe(true);
  });

  it('meets WCAG AA (>= 4.5:1) for light and dark text across page and paper surfaces', () => {
    for (const spec of [lightSpec, darkSpec]) {
      for (const surface of [spec.surfaces.page, spec.surfaces.paper]) {
        expect(contrastRatio(spec.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(spec.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(spec.text.muted, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(spec.primary.main, surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(spec.primary.contrastText, spec.primary.main)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(spec.status.good, spec.surfaces.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(spec.status.critical, spec.surfaces.paper)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('meets WCAG AAA (>= 7:1) for high-contrast text and >= 4.5:1 for high-contrast accents and charts', () => {
    for (const surface of [highContrastSpec.surfaces.page, highContrastSpec.surfaces.paper]) {
      expect(contrastRatio(highContrastSpec.text.primary, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.text.secondary, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.text.muted, surface)).toBeGreaterThanOrEqual(7);

      expect(contrastRatio(highContrastSpec.primary.main, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.status.good, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.status.warning, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.status.critical, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.divider, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.chart.axis, surface)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(highContrastSpec.chart.neutral, surface)).toBeGreaterThanOrEqual(7);

      for (const seriesColor of highContrastSpec.chart.series) {
        expect(contrastRatio(seriesColor, surface)).toBeGreaterThanOrEqual(7);
      }
    }

    expect(
      contrastRatio(highContrastSpec.primary.contrastText, highContrastSpec.primary.main),
    ).toBeGreaterThanOrEqual(7);
  });

  it('provides well-contrasted chart series in light and dark themes', () => {
    for (const color of darkSpec.chart.series) {
      expect(contrastRatio(color, darkSpec.surfaces.paper)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(darkSpec.chart.neutral, darkSpec.surfaces.paper)).toBeGreaterThanOrEqual(
      4.5,
    );

    for (const color of lightSpec.chart.series) {
      expect(contrastRatio(color, lightSpec.surfaces.paper)).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(lightSpec.chart.neutral, lightSpec.surfaces.paper)).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('builds themes with high-contrast affordances and reduced-motion transitions', () => {
    const hcTheme = buildTheme(highContrastSpec);
    expect(hcTheme.components?.MuiLink?.defaultProps?.underline).toBe('always');
    expect(hcTheme.chart.seriesDash).toEqual(['none', '8 4', '2 4']);
    expect(hcTheme.chart.showMarks).toBe(true);

    const reducedMotionTheme = buildTheme(lightSpec, { reducedMotion: true });
    expect(reducedMotionTheme.transitions.create('opacity')).toBe('none');
  });
});
