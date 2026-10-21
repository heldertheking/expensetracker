import { z } from 'zod';
import { Id } from './id.js';
import { IsoDate } from './iso-date.js';
import { MoneyCents } from './money.js';
import { Timestamp } from './timestamp.js';
import { text } from './text.js';

const TRANSACTION_DESCRIPTION_MAX = 200;

const TransactionDescription = text(TRANSACTION_DESCRIPTION_MAX);

/** `main` shows every transaction, `savings` only the savings ones. */
const Account = z.enum(['main', 'savings']);
type Account = z.infer<typeof Account>;

const TransactionType = z.enum(['income', 'expense']);
type TransactionType = z.infer<typeof TransactionType>;

/**
 * A single income or expense. `projectId` null means it belongs to no project. On the savings
 * account an income is a deposit and an expense a withdrawal.
 */
const TransactionSchema = z.object({
  id: Id,
  account: Account,
  type: TransactionType,
  amountCents: MoneyCents,
  date: IsoDate,
  description: TransactionDescription,
  projectId: Id.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});

type Transaction = z.infer<typeof TransactionSchema>;

export { Account, TRANSACTION_DESCRIPTION_MAX, TransactionDescription, TransactionSchema };
export { TransactionType };
export type { Transaction };
