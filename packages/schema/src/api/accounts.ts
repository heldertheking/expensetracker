import { z } from 'zod';
import { ACCOUNTS, Account } from '../domain/transaction.js';

const TotalsSchema = z
  .object({
    incomeCents: z.number().int().nonnegative(),
    expenseCents: z.number().int().nonnegative(),
    balanceCents: z.number().int(), // can be negative
  })
  .refine((t) => t.balanceCents === t.incomeCents - t.expenseCents, {
    error: 'balanceCents must equal incomeCents - expenseCents',
    path: ['balanceCents'],
  });
type Totals = z.infer<typeof TotalsSchema>;

const AccountSummarySchema = z.intersection(z.object({ account: Account }), TotalsSchema);
type AccountSummary = z.infer<typeof AccountSummarySchema>;

const TOTAL_KEYS = ['incomeCents', 'expenseCents', 'balanceCents'] as const;

/**
 * `GET /api/accounts`: one summary per account, in the order of `ACCOUNTS`, plus the overall
 * total, which is the sum of both accounts.
 */
const AccountsResponse = z
  .object({
    accounts: z.array(AccountSummarySchema),
    total: TotalsSchema,
  })
  .refine((r) => r.accounts.map((a) => a.account).join() === ACCOUNTS.join(), {
    error: `accounts must list ${ACCOUNTS.join(' and ')} once each, in that order`,
    path: ['accounts'],
  })
  .refine(
    (r) =>
      TOTAL_KEYS.every((key) => r.total[key] === r.accounts.reduce((sum, a) => sum + a[key], 0)),
    { error: 'total must be the sum of the accounts', path: ['total'] },
  );
type AccountsResponse = z.infer<typeof AccountsResponse>;

export { AccountSummarySchema, AccountsResponse, TotalsSchema };
export type { AccountSummary, Totals };
