import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: string;
  detail?: ReactNode;
  hero?: boolean;
  /** Direction of the value, shown with an arrow and a color that means "good" or "bad". */
  trend?: 'up' | 'down' | 'flat';
}

export function StatTile({ label, value, detail, hero, trend }: StatTileProps) {
  return (
    <section className={`card stat-tile ${hero ? 'stat-hero' : ''}`} aria-label={label}>
      <h2 className="stat-label">{label}</h2>
      <p className={`stat-value ${trend ? `trend-${trend}` : ''}`}>
        {trend && trend !== 'flat' && (
          <span className="trend-icon" aria-hidden="true">
            {trend === 'up' ? '▲' : '▼'}{' '}
          </span>
        )}
        {value}
      </p>
      {detail && <p className="stat-detail">{detail}</p>}
    </section>
  );
}
