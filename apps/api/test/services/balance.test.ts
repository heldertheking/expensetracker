import { AccountsResponse } from '@expensetracker/schema';
import { describe, expect, it } from 'vitest';
import { accountBalances } from '../../src/services/balance.js';

const zero = { incomeCents: 0, expenseCents: 0, balanceCents: 0 };

describe('accountBalances', () => {
  it('lists both accounts with zeros when there are no transactions', () => {
    expect(accountBalances([])).toEqual({
      accounts: [
        { account: 'main', ...zero },
        { account: 'savings', ...zero },
      ],
      total: zero,
    });
  });

  it('computes the balance of each account as income minus expense', () => {
    const result = accountBalances([
      { account: 'main', type: 'income', totalCents: 500_000 },
      { account: 'main', type: 'expense', totalCents: 320_000 },
      { account: 'savings', type: 'income', totalCents: 100_000 },
      { account: 'savings', type: 'expense', totalCents: 25_000 },
    ]);

    expect(result.accounts).toEqual([
      { account: 'main', incomeCents: 500_000, expenseCents: 320_000, balanceCents: 180_000 },
      { account: 'savings', incomeCents: 100_000, expenseCents: 25_000, balanceCents: 75_000 },
    ]);
  });

  it('sums both accounts into the overall total', () => {
    const result = accountBalances([
      { account: 'main', type: 'income', totalCents: 500_000 },
      { account: 'main', type: 'expense', totalCents: 320_000 },
      { account: 'savings', type: 'income', totalCents: 100_000 },
    ]);

    expect(result.total).toEqual({
      incomeCents: 600_000,
      expenseCents: 320_000,
      balanceCents: 280_000,
    });
  });

  it('allows a negative balance', () => {
    const result = accountBalances([{ account: 'main', type: 'expense', totalCents: 1_000 }]);

    expect(result.accounts[0]).toEqual({
      account: 'main',
      incomeCents: 0,
      expenseCents: 1_000,
      balanceCents: -1_000,
    });
    expect(result.total.balanceCents).toBe(-1_000);
  });

  it('keeps the account order of the contract whatever order the sums come in', () => {
    const result = accountBalances([
      { account: 'savings', type: 'income', totalCents: 2 },
      { account: 'main', type: 'income', totalCents: 1 },
    ]);

    expect(result.accounts.map((a) => a.account)).toEqual(['main', 'savings']);
  });

  it('adds up repeated sums for the same account and type', () => {
    const result = accountBalances([
      { account: 'main', type: 'income', totalCents: 1 },
      { account: 'main', type: 'income', totalCents: 2 },
    ]);

    expect(result.accounts[0]!.incomeCents).toBe(3);
  });

  it('satisfies the AccountsResponse contract', () => {
    const result = accountBalances([
      { account: 'main', type: 'income', totalCents: 10 },
      { account: 'savings', type: 'expense', totalCents: 7 },
    ]);

    expect(AccountsResponse.safeParse(result).success).toBe(true);
  });
});
