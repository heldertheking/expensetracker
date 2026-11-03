import { useTheme } from '@mui/material/styles';
import { BarPlot } from '@mui/x-charts/BarChart';
import { ChartsAxisHighlight } from '@mui/x-charts/ChartsAxisHighlight';
import { ChartsContainer } from '@mui/x-charts/ChartsContainer';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import type { MonthlyFlow } from '@expensetracker/schema';
import { formatChf, formatCompactChf, formatSignedChf } from '../../lib/money';
import { formatMonth } from '../../lib/dates';
import { ChartCard, ChartLegend } from './ChartCard';
import { DataTable } from './DataTable';
import { CHART_HEIGHT, axisSx, monthAxis } from './chartProps';

export function flowSummary(monthly: MonthlyFlow[]): string {
  const income = monthly.reduce((sum, m) => sum + m.incomeCents, 0);
  const expense = monthly.reduce((sum, m) => sum + m.expenseCents, 0);
  const months = monthly.length === 1 ? '1 month' : `${monthly.length} months`;
  return `Over ${months}: income ${formatChf(income)}, expenses ${formatChf(expense)}, net ${formatSignedChf(income - expense)}.`;
}

const chf = (v: number | null) => (v === null ? '' : formatChf(v));

/** Income and expenses as grouped columns, net as a line on the same axis. */
export function MonthlyFlowChart({
  monthly,
  dimmed,
}: {
  monthly: MonthlyFlow[];
  dimmed?: boolean;
}) {
  const { chart } = useTheme();
  const [income, expense, net] = chart.series;
  return (
    <ChartCard
      title="Income vs. expenses"
      summary={flowSummary(monthly)}
      dimmed={dimmed}
      legend={
        <ChartLegend
          items={[
            { label: 'Income', color: income, shape: 'rect' },
            { label: 'Expenses', color: expense, shape: 'rect' },
            { label: 'Net', color: net, shape: 'line' },
          ]}
        />
      }
      table={
        <DataTable
          caption="Income and expenses per month"
          columns={['Month', 'Income', 'Expenses', 'Net']}
          rows={monthly.map((m) => ({
            key: m.month,
            label: formatMonth(m.month, true),
            values: [
              formatChf(m.incomeCents),
              formatChf(m.expenseCents),
              formatSignedChf(m.netCents),
            ],
          }))}
        />
      }
    >
      <ChartsContainer
        height={CHART_HEIGHT}
        skipAnimation
        margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
        xAxis={[
          {
            ...monthAxis(
              monthly.map((m) => m.month),
              'band',
            ),
            categoryGapRatio: 0.45,
            barGapRatio: 0.1,
          },
        ]}
        yAxis={[{ width: 48, valueFormatter: (v: number) => formatCompactChf(v) }]}
        series={[
          {
            type: 'bar',
            label: 'Income',
            color: income,
            data: monthly.map((m) => m.incomeCents),
            valueFormatter: chf,
          },
          {
            type: 'bar',
            label: 'Expenses',
            color: expense,
            data: monthly.map((m) => m.expenseCents),
            valueFormatter: chf,
          },
          {
            type: 'line',
            label: 'Net',
            color: net,
            data: monthly.map((m) => m.netCents),
            valueFormatter: (v: number | null) => (v === null ? '' : formatSignedChf(v)),
          },
        ]}
        sx={axisSx}
      >
        <ChartsGrid horizontal />
        <BarPlot borderRadius={4} />
        <ChartsReferenceLine y={0} lineStyle={{ stroke: chart.axis }} />
        <LinePlot />
        <MarkPlot />
        <ChartsXAxis />
        <ChartsYAxis />
        <ChartsAxisHighlight x="band" />
        <ChartsTooltip trigger="axis" />
      </ChartsContainer>
    </ChartCard>
  );
}
