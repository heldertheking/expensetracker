import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyBalance } from '@expensetracker/schema';
import { formatChf, formatCompactChf } from '../../lib/money';
import { formatMonth } from '../../lib/dates';
import { CHART_HEIGHT, INITIAL_DIMENSION, axisProps, gridProps, SERIES } from './theme';
import { ChartCard, ChartLegend, TooltipBox } from './ChartCard';

const LINES = [
  { key: 'totalCents', label: 'Total', color: SERIES[0] },
  { key: 'mainCents', label: 'Main', color: SERIES[1] },
  { key: 'savingsCents', label: 'Savings', color: SERIES[2] },
] as const;

export function balanceSummary(balances: MonthlyBalance[]): string {
  const first = balances[0];
  const last = balances.at(-1);
  if (!first || !last) return 'No balances in this range.';
  const verb = last.totalCents >= first.totalCents ? 'grew' : 'fell';
  return `Total balance ${verb} from ${formatChf(first.totalCents)} at the end of ${formatMonth(first.month, true)} to ${formatChf(last.totalCents)} at the end of ${formatMonth(last.month, true)}.`;
}

export function BalanceChart({
  balances,
  dimmed,
}: {
  balances: MonthlyBalance[];
  dimmed?: boolean;
}) {
  const byMonth = new Map(balances.map((b) => [b.month, b]));
  return (
    <ChartCard
      title="Balance over time"
      summary={balanceSummary(balances)}
      className="span-2"
      dimmed={dimmed}
      legend={<ChartLegend items={LINES.map((l) => ({ ...l, shape: 'line' as const }))} />}
      table={
        <table className="data-table">
          <caption className="visually-hidden">Month-end balances</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {LINES.map((l) => (
                <th key={l.key} scope="col" className="num">
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.month}>
                <th scope="row">{formatMonth(b.month, true)}</th>
                {LINES.map((l) => (
                  <td key={l.key} className="num">
                    {formatChf(b[l.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={INITIAL_DIMENSION}>
        <ComposedChart data={balances} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" tickFormatter={(m: string) => formatMonth(m)} {...axisProps} />
          <YAxis tickFormatter={formatCompactChf} width={48} {...axisProps} />
          <Tooltip
            cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
            content={({ active, label }) => {
              const row = active ? byMonth.get(String(label)) : undefined;
              if (!row) return null;
              return (
                <TooltipBox
                  title={formatMonth(row.month, true)}
                  rows={LINES.map((l) => ({
                    label: l.label,
                    color: l.color,
                    value: formatChf(row[l.key]),
                  }))}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="totalCents"
            stroke="none"
            fill={SERIES[0]}
            fillOpacity={0.1}
            isAnimationActive={false}
            activeDot={false}
            tooltipType="none"
          />
          {LINES.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
