import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyFlow } from '@expensetracker/schema';
import { formatChf, formatCompactChf, formatSignedChf } from '../../lib/money';
import { formatMonth } from '../../lib/dates';
import { CHART_HEIGHT, INITIAL_DIMENSION, axisProps, gridProps, SERIES } from './theme';
import { ChartCard, ChartLegend, TooltipBox } from './ChartCard';

export function flowSummary(monthly: MonthlyFlow[]): string {
  const income = monthly.reduce((sum, m) => sum + m.incomeCents, 0);
  const expense = monthly.reduce((sum, m) => sum + m.expenseCents, 0);
  const months = monthly.length === 1 ? '1 month' : `${monthly.length} months`;
  return `Over ${months}: income ${formatChf(income)}, expenses ${formatChf(expense)}, net ${formatSignedChf(income - expense)}.`;
}

export function MonthlyFlowChart({
  monthly,
  dimmed,
}: {
  monthly: MonthlyFlow[];
  dimmed?: boolean;
}) {
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  return (
    <ChartCard
      title="Income vs. expenses"
      summary={flowSummary(monthly)}
      dimmed={dimmed}
      legend={
        <ChartLegend
          items={[
            { label: 'Income', color: SERIES[0], shape: 'rect' },
            { label: 'Expenses', color: SERIES[1], shape: 'rect' },
            { label: 'Net', color: SERIES[2], shape: 'line' },
          ]}
        />
      }
      table={
        <table className="data-table">
          <caption className="visually-hidden">Income and expenses per month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className="num">
                Income
              </th>
              <th scope="col" className="num">
                Expenses
              </th>
              <th scope="col" className="num">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month}>
                <th scope="row">{formatMonth(m.month, true)}</th>
                <td className="num">{formatChf(m.incomeCents)}</td>
                <td className="num">{formatChf(m.expenseCents)}</td>
                <td className="num">{formatSignedChf(m.netCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={INITIAL_DIMENSION}>
        <ComposedChart
          data={monthly}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          barGap={2}
          barCategoryGap="20%"
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" tickFormatter={(m: string) => formatMonth(m)} {...axisProps} />
          <YAxis tickFormatter={formatCompactChf} width={48} {...axisProps} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Tooltip
            cursor={{ fill: 'var(--hover-wash)' }}
            content={({ active, label }) => {
              const row = active ? byMonth.get(String(label)) : undefined;
              if (!row) return null;
              return (
                <TooltipBox
                  title={formatMonth(row.month, true)}
                  rows={[
                    { label: 'Income', color: SERIES[0], value: formatChf(row.incomeCents) },
                    { label: 'Expenses', color: SERIES[1], value: formatChf(row.expenseCents) },
                    { label: 'Net', color: SERIES[2], value: formatSignedChf(row.netCents) },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="incomeCents"
            name="Income"
            fill={SERIES[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expenseCents"
            name="Expenses"
            fill={SERIES[1]}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="netCents"
            name="Net"
            stroke={SERIES[2]}
            strokeWidth={2}
            dot={{ r: 4, fill: SERIES[2], stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
