import { ACCOUNTS } from '@expensetracker/schema';
import type { AccountsResponse, Totals } from '@expensetracker/schema';
import type { AccountTypeTotal } from '../repositories/transaction-repository.js';

/**
 * Balance per account (`income - expense`) in the order of `ACCOUNTS`, plus the overall total,
 * from the sums per account and type. Accounts without transactions are listed with zeros.
 */
function accountBalances(sums: readonly AccountTypeTotal[]): AccountsResponse {
  const accounts = ACCOUNTS.map((account) => {
    const sumOf = (type: AccountTypeTotal['type']) =>
      sums
        .filter((s) => s.account === account && s.type === type)
        .reduce((total, s) => total + s.totalCents, 0);
    const incomeCents = sumOf('income');
    const expenseCents = sumOf('expense');
    return { account, incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
  });

  const total: Totals = { incomeCents: 0, expenseCents: 0, balanceCents: 0 };
  for (const summary of accounts) {
    total.incomeCents += summary.incomeCents;
    total.expenseCents += summary.expenseCents;
    total.balanceCents += summary.balanceCents;
  }
  return { accounts, total };
}

export { accountBalances };
