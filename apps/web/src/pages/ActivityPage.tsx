import { useState } from 'react';
import { BUSINESS_EVENT_TYPES } from '@expensetracker/schema';
import type { BusinessEventType } from '@expensetracker/schema';
import { listEvents } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import { EVENT_TYPE_LABELS } from '../lib/events';
import { ActivityList } from '../components/ActivityList';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, Loading } from '../components/States';

export const ACTIVITY_PAGE_SIZE = 20;

export function ActivityPage() {
  const [type, setType] = useState<BusinessEventType | ''>('');
  const [offset, setOffset] = useState(0);
  const query = { type: type || undefined, limit: ACTIVITY_PAGE_SIZE, offset };
  const events = useApi((signal) => listEvents(query, signal), JSON.stringify(query));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Activity</h1>
          <p className="muted">Every change to transactions and projects, newest first.</p>
        </div>
      </header>

      <div className="filters">
        <label className="inline-field">
          <span>Event type</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as BusinessEventType | '');
              setOffset(0);
            }}
          >
            <option value="">All events</option>
            {BUSINESS_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={`card ${events.loading && events.data ? 'is-dimmed' : ''}`}>
        {events.error !== undefined ? (
          <ErrorState
            error={events.error}
            title="Could not load activity"
            onRetry={events.reload}
          />
        ) : events.data === undefined ? (
          <Loading label="Loading activity" />
        ) : events.data.items.length === 0 ? (
          <EmptyState title={type ? 'No events of this type' : 'Nothing happened yet'}>
            {type
              ? 'Choose another event type.'
              : 'Changes to transactions and projects appear here.'}
          </EmptyState>
        ) : (
          <>
            <ActivityList events={events.data.items} />
            <Pagination
              total={events.data.total}
              limit={events.data.limit}
              offset={events.data.offset}
              onChange={setOffset}
              label="Activity pages"
            />
          </>
        )}
      </section>
    </div>
  );
}
