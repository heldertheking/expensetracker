import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { NO_PROJECT_NAME } from '@expensetracker/schema';
import type { ProjectExpense } from '@expensetracker/schema';
import { formatChf, formatCompactChf } from '../../lib/money';
import { EmptyState } from '../States';
import { ChartCard } from './ChartCard';
import { DataTable } from './DataTable';
import { axisSx } from './chartProps';

const MAX_BARS = 7;

interface Row {
  key: string;
  name: string;
  expenseCents: number;
  untagged: boolean;
}

/** Largest first; the tail beyond `MAX_BARS` folds into "Other projects". */
export function spendingRows(items: ProjectExpense[]): Row[] {
  const rows: Row[] = items.map((p) => ({
    key: p.projectId ?? 'none',
    name: p.projectId === null ? NO_PROJECT_NAME : p.name,
    expenseCents: p.expenseCents,
    untagged: p.projectId === null,
  }));
  if (rows.length <= MAX_BARS) return rows;
  const head = rows.slice(0, MAX_BARS - 1);
  const rest = rows.slice(MAX_BARS - 1).reduce((sum, r) => sum + r.expenseCents, 0);
  return [...head, { key: 'other', name: 'Other projects', expenseCents: rest, untagged: false }];
}

export function spendingSummary(items: ProjectExpense[]): string {
  const total = items.reduce((sum, p) => sum + p.expenseCents, 0);
  const top = items[0];
  if (!top) return 'No expenses in this range.';
  const name = top.projectId === null ? 'untagged expenses' : top.name;
  const share = Math.round((top.expenseCents / total) * 100);
  return `Expenses total ${formatChf(total)}; the largest share is ${name} with ${formatChf(top.expenseCents)} (${share}%).`;
}

/** Ranked horizontal bars in one color; untagged spending recedes in neutral gray. */
export function ProjectSpendingChart({
  items,
  dimmed,
}: {
  items: ProjectExpense[];
  dimmed?: boolean;
}) {
  const { chart } = useTheme();
  const rows = spendingRows(items);
  const height = Math.max(120, rows.length * 40 + 24);
  const maxExpense = Math.max(1, ...rows.map((r) => r.expenseCents));
  return (
    <ChartCard
      title="Spending per project"
      summary={spendingSummary(items)}
      dimmed={dimmed}
      table={
        <DataTable
          caption="Expenses per project"
          columns={['Project', 'Expenses']}
          rows={items.map((p) => ({
            key: p.projectId ?? 'none',
            label: p.projectId === null ? NO_PROJECT_NAME : p.name,
            values: [formatChf(p.expenseCents)],
          }))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="No expenses in this range">
          Expenses appear here, grouped by their project tag.
        </EmptyState>
      ) : (
        <BarChart
          layout="horizontal"
          height={height}
          hideLegend
          skipAnimation
          borderRadius={4}
          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
          yAxis={[
            {
              scaleType: 'band',
              data: rows.map((r) => r.name),
              width: 110,
              categoryGapRatio: 0.4,
              colorMap: {
                type: 'ordinal',
                values: rows.map((r) => r.name),
                colors: rows.map((r) => (r.untagged ? chart.neutral : chart.series[0])),
              },
            },
          ]}
          // headroom past the longest bar, so its outside label fits inside the plot
          xAxis={[{ position: 'none', min: 0, max: maxExpense * 1.8 }]}
          series={[
            {
              label: 'Expenses',
              data: rows.map((r) => r.expenseCents),
              valueFormatter: (v: number | null) => (v === null ? '' : formatChf(v)),
              // compact at the bar end; the exact amount is in the tooltip and the table
              barLabel: (item) =>
                item.value === null ? null : `CHF ${formatCompactChf(item.value)}`,
              barLabelPlacement: 'outside',
            },
          ]}
          sx={axisSx}
        />
      )}
    </ChartCard>
  );
}
