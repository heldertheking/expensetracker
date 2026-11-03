import { z } from 'zod';
import { BusinessEventSchema, BusinessEventType } from '../domain/event.js';

/** `GET /api/events`: the event log, newest first. */
const ListEventsQuery = z.strictObject({
  type: BusinessEventType.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
type ListEventsQuery = z.infer<typeof ListEventsQuery>;

const EventListResponse = z
  .object({
    items: z.array(BusinessEventSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().min(1),
    offset: z.number().int().nonnegative(),
  })
  .refine((page) => page.items.length <= page.limit, {
    error: 'items must not exceed limit',
    path: ['items'],
  })
  .refine((page) => page.offset + page.items.length <= page.total, {
    error: 'offset plus items must not exceed total',
    path: ['total'],
  })
  .refine(
    (page) => page.items.every((e, i) => i === 0 || page.items[i - 1]!.sequence > e.sequence),
    { error: 'items must be ordered newest first', path: ['items'] },
  );
type EventListResponse = z.infer<typeof EventListResponse>;

export { EventListResponse, ListEventsQuery };
