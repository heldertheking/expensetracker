import type { AccountsResponse } from '@expensetracker/schema';
import type { AccountTypeTotal } from '../repositories/transaction-repository.js';

/**
 * Balance per account (`income - expense`) in the order of `ACCOUNTS`, plus the overall total,
 * from the sums per account and type. Accounts without transactions are listed with zeros.
 */
function accountBalances(sums: readonly AccountTypeTotal[]): AccountsResponse {
  void sums;
  throw new Error('not implemented');
}

export { accountBalances };
