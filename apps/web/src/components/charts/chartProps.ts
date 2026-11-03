import type { Theme } from '@mui/material/styles';
import { axisClasses } from '@mui/x-charts/ChartsAxis';
import { chartsGridClasses } from '@mui/x-charts/ChartsGrid';
import { formatMonth } from '../../lib/dates';

export const CHART_HEIGHT = 260;

/** A month axis: short labels on the axis, long ones in the tooltip. */
export function monthAxis(months: string[], scaleType: 'point' | 'band') {
  return {
    scaleType,
    data: months,
    valueFormatter: (month: string, context: { location: string }) =>
      formatMonth(month, context.location === 'tooltip'),
  } as const;
}

/** Recessive hairline axes and grid in the theme's chart colors. */
export function axisSx(theme: Theme) {
  return {
    [`& .${axisClasses.line}, & .${axisClasses.tick}`]: { stroke: theme.chart.axis },
    [`& .${axisClasses.tickLabel}`]: { fill: theme.palette.text.secondary },
    [`& .${chartsGridClasses.line}`]: { stroke: theme.chart.grid, strokeDasharray: 'none' },
  };
}
