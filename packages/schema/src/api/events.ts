import { z } from 'zod';
import { BusinessEventSchema, BusinessEventType } from '../domain/event.js';
import { page } from './page.js';

/** `GET /api/events`: the event log, newest first. */
const ListEventsQuery = z.strictObject({
  type: BusinessEventType.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
type ListEventsQuery = z.infer<typeof ListEventsQuery>;

const EventListResponse = page(BusinessEventSchema).refine(
  (p) => p.items.every((e, i) => i === 0 || p.items[i - 1]!.sequence > e.sequence),
  { error: 'items must be ordered newest first', path: ['items'] },
);
type EventListResponse = z.infer<typeof EventListResponse>;

export { EventListResponse, ListEventsQuery };
