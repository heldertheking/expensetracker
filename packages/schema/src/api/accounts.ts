import { z } from 'zod';
import { Account } from '../domain/transaction.js';

const AccountSummaryParams = z.strictObject({ view: Account });

/** Totals for a view. `main` covers every transaction, `savings` only the savings ones. */
const AccountSummaryResponse = z.object({
  view: Account,
  incomeCents: z.number().int().nonnegative(),
  expenseCents: z.number().int().nonnegative(),
  balanceCents: z.number().int(), // can be negative
});
type AccountSummaryResponse = z.infer<typeof AccountSummaryResponse>;

export { AccountSummaryParams, AccountSummaryResponse };
