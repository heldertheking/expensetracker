import { z } from 'zod';
import { Id } from './id.js';
import { ProjectRecordSchema } from './project.js';
import { Timestamp } from './timestamp.js';
import { TransactionSchema } from './transaction.js';

/**
 * Every change to the data is a business event, named after the business action
 * (`CreateTransactionEvent`). The API runs each one through the same pipeline and appends it to
 * an append-only event log, so the log is the history of everything that happened.
 * Payloads hold snapshots of the stored records; derived totals are never part of an event.
 */
const BUSINESS_EVENT_TYPES = [
  'CreateTransactionEvent',
  'UpdateTransactionEvent',
  'DeleteTransactionEvent',
  'CreateProjectEvent',
  'UpdateProjectEvent',
  'DeleteProjectEvent',
] as const;
const BusinessEventType = z.enum(BUSINESS_EVENT_TYPES);
type BusinessEventType = z.infer<typeof BusinessEventType>;

const envelope = {
  id: Id,
  sequence: z.number().int().positive(), // position in the event log, increasing
  occurredAt: Timestamp,
};

const changeOf = <T extends z.ZodType>(record: T) => z.object({ before: record, after: record });

const BusinessEventSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelope,
    type: z.literal('CreateTransactionEvent'),
    payload: z.object({ transaction: TransactionSchema }),
  }),
  z.object({
    ...envelope,
    type: z.literal('UpdateTransactionEvent'),
    payload: changeOf(TransactionSchema),
  }),
  z.object({
    ...envelope,
    type: z.literal('DeleteTransactionEvent'),
    payload: z.object({ transaction: TransactionSchema }),
  }),
  z.object({
    ...envelope,
    type: z.literal('CreateProjectEvent'),
    payload: z.object({ project: ProjectRecordSchema }),
  }),
  z.object({
    ...envelope,
    type: z.literal('UpdateProjectEvent'),
    payload: changeOf(ProjectRecordSchema),
  }),
  z.object({
    ...envelope,
    type: z.literal('DeleteProjectEvent'),
    payload: z.object({ project: ProjectRecordSchema }),
  }),
]);
type BusinessEvent = z.infer<typeof BusinessEventSchema>;
type BusinessEventOf<T extends BusinessEventType> = Extract<BusinessEvent, { type: T }>;

export { BUSINESS_EVENT_TYPES, BusinessEventSchema, BusinessEventType };
export type { BusinessEvent, BusinessEventOf };
