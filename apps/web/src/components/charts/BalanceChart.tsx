import { useTheme } from '@mui/material/styles';
import { LineChart, lineClasses } from '@mui/x-charts/LineChart';
import type { MonthlyBalance } from '@expensetracker/schema';
import { formatChf, formatCompactChf } from '../../lib/money';
import { formatMonth } from '../../lib/dates';
import { ChartCard, ChartLegend } from './ChartCard';
import { DataTable } from './DataTable';
import { CHART_HEIGHT, axisSx, monthAxis } from './chartProps';

export function balanceSummary(balances: MonthlyBalance[]): string {
  const first = balances[0];
  const last = balances.at(-1);
  if (!first || !last) return 'No balances in this range.';
  const verb = last.totalCents >= first.totalCents ? 'grew' : 'fell';
  return `Total balance ${verb} from ${formatChf(first.totalCents)} at the end of ${formatMonth(first.month, true)} to ${formatChf(last.totalCents)} at the end of ${formatMonth(last.month, true)}.`;
}

const LINES = [
  { key: 'totalCents', label: 'Total' },
  { key: 'mainCents', label: 'Main' },
  { key: 'savingsCents', label: 'Savings' },
] as const;

export function BalanceChart({
  balances,
  dimmed,
}: {
  balances: MonthlyBalance[];
  dimmed?: boolean;
}) {
  const { chart } = useTheme();
  const lines = LINES.map((line, i) => ({ ...line, color: chart.series[i]! }));
  return (
    <ChartCard
      title="Balance over time"
      summary={balanceSummary(balances)}
      wide
      dimmed={dimmed}
      legend={<ChartLegend items={lines.map((l) => ({ ...l, shape: 'line' as const }))} />}
      table={
        <DataTable
          caption="Month-end balances"
          columns={['Month', ...lines.map((l) => l.label)]}
          rows={balances.map((b) => ({
            key: b.month,
            label: formatMonth(b.month, true),
            values: lines.map((l) => formatChf(b[l.key])),
          }))}
        />
      }
    >
      <LineChart
        height={CHART_HEIGHT}
        hideLegend
        skipAnimation
        grid={{ horizontal: true }}
        margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
        xAxis={[
          monthAxis(
            balances.map((b) => b.month),
            'point',
          ),
        ]}
        yAxis={[{ width: 48, valueFormatter: (v: number) => formatCompactChf(v) }]}
        series={lines.map((line, i) => ({
          id: line.key,
          label: line.label,
          color: line.color,
          data: balances.map((b) => b[line.key]),
          valueFormatter: (v: number | null) => (v === null ? '' : formatChf(v)),
          showMark: false,
          curve: 'monotoneX',
          area: i === 0, // a light wash under the total only
        }))}
        sx={(theme) => ({
          ...axisSx(theme),
          [`& .${lineClasses.area}`]: { fillOpacity: 0.1 },
          [`& .${lineClasses.line}`]: { strokeWidth: 2 },
        })}
      />
    </ChartCard>
  );
}
