import { z } from 'zod';
import { Id } from './id.js';
import { IsoDate } from './iso-date.js';
import { MoneyCents } from './money.js';
import { Timestamp } from './timestamp.js';
import { text } from './text.js';

const TRANSACTION_DESCRIPTION_MAX = 200;

const TransactionDescription = text(TRANSACTION_DESCRIPTION_MAX);

/**
 * Every transaction is booked on exactly one account: `main` is the normal (everyday) account,
 * `savings` the savings account. Overall totals are the sum of both.
 */
const ACCOUNTS = ['main', 'savings'] as const;
const Account = z.enum(ACCOUNTS);
type Account = z.infer<typeof Account>;

const TransactionType = z.enum(['income', 'expense']);
type TransactionType = z.infer<typeof TransactionType>;

/**
 * A single income or expense on one account. `projectId` tags it with a project, which then counts
 * it against that project's budget; null means it is not part of a project. On the savings
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

export {
  ACCOUNTS,
  Account,
  TRANSACTION_DESCRIPTION_MAX,
  TransactionDescription,
  TransactionSchema,
};
export { TransactionType };
export type { Transaction };
