import { useId, useState } from 'react';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  /** One-sentence takeaway; it is also the chart's accessible description. */
  summary: string;
  /** Legend, rendered above the plot. */
  legend?: ReactNode;
  /** The same data as a table: the accessible twin of the chart and the home of every value. */
  table: ReactNode;
  children: ReactNode;
  className?: string;
  dimmed?: boolean;
}

/**
 * A chart in a card. The plot is an image with a name and a summary for screen readers; the
 * "Show table" toggle swaps in the full data as a table.
 */
export function ChartCard({
  title,
  summary,
  legend,
  table,
  children,
  className,
  dimmed,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const summaryId = useId();
  return (
    <section
      className={`card chart-card ${className ?? ''} ${dimmed ? 'is-dimmed' : ''}`}
      aria-labelledby={titleId}
    >
      <header className="card-header">
        <div>
          <h2 id={titleId} className="card-title">
            {title}
          </h2>
          <p id={summaryId} className="card-summary">
            {summary}
          </p>
        </div>
        <button
          type="button"
          className="button ghost small"
          aria-pressed={showTable}
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </header>
      {showTable ? (
        <div className="table-wrap">{table}</div>
      ) : (
        <>
          {legend}
          <div
            className="chart-plot"
            role="img"
            aria-labelledby={titleId}
            aria-describedby={summaryId}
          >
            {children}
          </div>
        </>
      )}
    </section>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  shape: 'line' | 'rect';
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="chart-legend" aria-label="Legend">
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={`legend-key legend-${item.shape}`}
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

interface TooltipRow {
  label: string;
  value: string;
  color: string;
}

/** Tooltip body: value first and strong, series name after, keyed by a short line. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{title}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.label}>
            <span className="tooltip-key" style={{ background: row.color }} aria-hidden="true" />
            <strong>{row.value}</strong>
            <span className="muted">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
