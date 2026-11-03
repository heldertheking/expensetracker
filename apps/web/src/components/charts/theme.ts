/**
 * Chart colors are CSS custom properties (defined in `styles.css` for light and dark), so the
 * charts follow the theme without re-rendering. Categorical slots are used in fixed order.
 */
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'] as const;

export const CHART_HEIGHT = 260;

/** Size used before (or without) a measurement, e.g. in tests where layout does not run. */
export const INITIAL_DIMENSION = { width: 640, height: CHART_HEIGHT };

export const axisProps = {
  stroke: 'var(--axis)',
  tick: { fill: 'var(--text-muted)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--axis)' },
} as const;

export const gridProps = {
  stroke: 'var(--grid)',
  vertical: false,
} as const;
