import { z } from 'zod';
import { Id } from '../domain/id.js';
import { IsoDate } from '../domain/iso-date.js';
import { MoneyCents } from '../domain/money.js';
import {
  Account,
  TransactionDescription,
  TransactionSchema,
  TransactionType,
} from '../domain/transaction.js';
import type { Transaction } from '../domain/transaction.js';
import type { ValidationIssue } from './errors.js';
import { readonlyFields, SERVER_MANAGED } from './readonly.js';
import { changedFields, NOTHING_CHANGED } from './update.js';

const EARLIEST_DATE = '2000-01-01';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today plus one day, so a client ahead of UTC can still record "today". ISO dates sort as text. */
const latestAllowedDate = () => new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);

/** Input is strict: a transaction records something that already happened. */
const TransactionDateInput = IsoDate.refine((date) => date >= EARLIEST_DATE, {
  error: `date must not be before ${EARLIEST_DATE}`,
}).refine((date) => date <= latestAllowedDate(), { error: 'date must not be in the future' });

const serverManaged = readonlyFields(['id', 'createdAt', 'updatedAt'], SERVER_MANAGED);

const CreateTransactionRequest = z.strictObject({
  account: Account.default('main'),
  type: TransactionType,
  amountCents: MoneyCents,
  date: TransactionDateInput,
  description: TransactionDescription,
  projectId: Id.nullable().default(null),
  ...serverManaged,
});
type CreateTransactionRequest = z.infer<typeof CreateTransactionRequest>;

const UPDATABLE_TRANSACTION_FIELDS = [
  'type',
  'amountCents',
  'date',
  'description',
  'projectId',
] as const;

const UpdateTransactionRequest = z
  .strictObject({
    type: TransactionType.optional(),
    amountCents: MoneyCents.optional(),
    date: TransactionDateInput.optional(),
    description: TransactionDescription.optional(),
    projectId: Id.nullable().optional(), // null detaches the transaction from its project
    account: z
      .never({ error: 'account cannot be changed; delete the transaction and create a new one' })
      .optional(),
    ...serverManaged,
  })
  .refine((patch) => UPDATABLE_TRANSACTION_FIELDS.some((field) => patch[field] !== undefined), {
    error: 'at least one field to update must be sent',
  });
type UpdateTransactionRequest = z.infer<typeof UpdateTransactionRequest>;

/**
 * Checks that need the stored transaction. Run after the request itself has been parsed:
 * - an update that changes nothing is rejected
 * - flipping income/expense inverts the balance impact, so the amount must be sent again
 */
function validateTransactionUpdate(
  existing: Transaction,
  patch: UpdateTransactionRequest,
): ValidationIssue[] {
  const changed = changedFields(existing, patch, UPDATABLE_TRANSACTION_FIELDS);
  if (changed.length === 0) return [{ path: '', message: NOTHING_CHANGED }];

  const issues: ValidationIssue[] = [];
  if (changed.includes('type') && patch.amountCents === undefined) {
    issues.push({
      path: 'amountCents',
      message:
        'amountCents must be sent again when type changes, to confirm the new balance impact',
    });
  }
  return issues;
}

const TransactionParams = z.strictObject({ id: Id });

/** `view=main` (default) lists every transaction, `view=savings` only the savings ones. */
const ListTransactionsQuery = z
  .strictObject({
    view: Account.default('main'),
    projectId: Id.optional(),
    type: TransactionType.optional(),
    from: IsoDate.optional(),
    to: IsoDate.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    error: 'from must not be after to',
    path: ['from'],
  });
type ListTransactionsQuery = z.infer<typeof ListTransactionsQuery>;

const TransactionResponse = TransactionSchema;
type TransactionResponse = z.infer<typeof TransactionResponse>;

const TransactionListResponse = z
  .object({
    items: z.array(TransactionSchema),
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
  });
type TransactionListResponse = z.infer<typeof TransactionListResponse>;

export { CreateTransactionRequest, ListTransactionsQuery, TransactionListResponse };
export { TransactionParams, TransactionResponse, UpdateTransactionRequest };
export { validateTransactionUpdate };
