import type { BusinessEvent } from '@expensetracker/schema';
import { describeEvent, EVENT_TYPE_LABELS } from '../lib/events';
import { formatDateTime } from '../lib/dates';

const TONE_ICONS = { create: '+', update: '✎', delete: '−' } as const;

export function ActivityList({ events }: { events: BusinessEvent[] }) {
  return (
    <ol className="activity-list">
      {events.map((event) => {
        const { title, detail, tone } = describeEvent(event);
        return (
          <li key={event.id} className={`activity-item tone-${tone}`}>
            <span className="activity-icon" aria-hidden="true">
              {TONE_ICONS[tone]}
            </span>
            <div className="activity-body">
              <p className="activity-title">{title}</p>
              {detail && <p className="activity-detail muted">{detail}</p>}
            </div>
            <div className="activity-meta">
              <span className="visually-hidden">{EVENT_TYPE_LABELS[event.type]}, </span>
              <time dateTime={event.occurredAt.toISOString()}>
                {formatDateTime(event.occurredAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
