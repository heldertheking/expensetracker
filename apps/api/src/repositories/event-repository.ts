import type { Database } from 'better-sqlite3';
import { BusinessEventSchema } from '@expensetracker/schema';
import type { BusinessEvent, BusinessEventType } from '@expensetracker/schema';

interface EventRow {
  sequence: number;
  id: string;
  type: BusinessEventType;
  occurred_at: string;
  payload: string;
}

/** A business event before it is stored; the log assigns the `sequence`. */
type NewBusinessEvent = BusinessEvent extends infer E
  ? E extends BusinessEvent
    ? Omit<E, 'sequence'>
    : never
  : never;

interface EventFilter {
  type?: BusinessEventType;
  limit: number;
  offset: number;
}

const toEvent = (row: EventRow): BusinessEvent =>
  BusinessEventSchema.parse({
    sequence: row.sequence,
    id: row.id,
    type: row.type,
    occurredAt: row.occurred_at,
    payload: JSON.parse(row.payload),
  });

/** SQL access to the append-only `events` table. There is no update or delete. */
function createEventRepository(db: Database) {
  const insert = db.prepare<[Omit<EventRow, 'sequence'>]>(
    `INSERT INTO events (id, type, occurred_at, payload)
     VALUES (@id, @type, @occurred_at, @payload)`,
  );
  const selectBySequence = db.prepare<[number], EventRow>(
    'SELECT * FROM events WHERE sequence = ?',
  );

  return {
    /**
     * Stores the event and returns it with its sequence. The stored event is parsed with the
     * schema, so an invalid event throws and the surrounding transaction rolls back.
     */
    append: (event: NewBusinessEvent): BusinessEvent => {
      const { lastInsertRowid } = insert.run({
        id: event.id,
        type: event.type,
        occurred_at: event.occurredAt.toISOString(),
        payload: JSON.stringify(event.payload),
      });
      return toEvent(selectBySequence.get(Number(lastInsertRowid))!);
    },
    /** Newest first. */
    list: (filter: EventFilter): { items: BusinessEvent[]; total: number } => {
      const where = filter.type === undefined ? '' : 'WHERE type = @type';
      const params = filter.type === undefined ? {} : { type: filter.type };
      const total = db
        .prepare<[object], { n: number }>(`SELECT COUNT(*) AS n FROM events ${where}`)
        .get(params)!.n;
      const rows = db
        .prepare<[object], EventRow>(
          `SELECT * FROM events ${where} ORDER BY sequence DESC LIMIT @limit OFFSET @offset`,
        )
        .all({ ...params, limit: filter.limit, offset: filter.offset });
      return { items: rows.map(toEvent), total };
    },
  };
}

type EventRepository = ReturnType<typeof createEventRepository>;

export { createEventRepository };
export type { EventFilter, EventRepository, NewBusinessEvent };
