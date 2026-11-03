import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NO_PROJECT_NAME } from '@expensetracker/schema';
import type { ProjectExpense } from '@expensetracker/schema';
import { formatChf, formatCompactChf } from '../../lib/money';
import { INITIAL_DIMENSION, axisProps, SERIES } from './theme';
import { ChartCard, TooltipBox } from './ChartCard';
import { EmptyState } from '../States';

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

export function ProjectSpendingChart({
  items,
  dimmed,
}: {
  items: ProjectExpense[];
  dimmed?: boolean;
}) {
  const rows = spendingRows(items);
  const height = Math.max(120, rows.length * 40 + 24);
  return (
    <ChartCard
      title="Spending per project"
      summary={spendingSummary(items)}
      dimmed={dimmed}
      table={
        <table className="data-table">
          <caption className="visually-hidden">Expenses per project</caption>
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col" className="num">
                Expenses
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.projectId ?? 'none'}>
                <th scope="row">{p.projectId === null ? NO_PROJECT_NAME : p.name}</th>
                <td className="num">{formatChf(p.expenseCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="No expenses in this range">
          Expenses appear here, grouped by their project tag.
        </EmptyState>
      ) : (
        <ResponsiveContainer
          width="100%"
          height={height}
          initialDimension={{ ...INITIAL_DIMENSION, height }}
        >
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 112, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid stroke="var(--grid)" horizontal={false} />
            <XAxis type="number" tickFormatter={formatCompactChf} {...axisProps} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              {...axisProps}
              axisLine={{ stroke: 'var(--axis)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--hover-wash)' }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                if (!row) return null;
                return (
                  <TooltipBox
                    title={row.name}
                    rows={[
                      {
                        label: 'Expenses',
                        color: row.untagged ? 'var(--neutral-series)' : SERIES[0],
                        value: formatChf(row.expenseCents),
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="expenseCents"
              name="Expenses"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell key={row.key} fill={row.untagged ? 'var(--neutral-series)' : SERIES[0]} />
              ))}
              <LabelList
                dataKey="expenseCents"
                position="right"
                formatter={(value: unknown) => formatChf(Number(value))}
                fill="var(--text-secondary)"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
