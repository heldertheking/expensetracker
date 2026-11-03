import { describe, expect, it } from 'vitest';
import { AccountsResponse } from '../src/index.js';

const summary = (account: string, incomeCents: number, expenseCents: number) => ({
  account,
  incomeCents,
  expenseCents,
  balanceCents: incomeCents - expenseCents,
});

const response = () => ({
  accounts: [summary('main', 500_000, 320_000), summary('savings', 100_000, 20_000)],
  total: { incomeCents: 600_000, expenseCents: 340_000, balanceCents: 260_000 },
});

describe('AccountsResponse', () => {
  it('accepts main and savings with their sum as total', () => {
    expect(AccountsResponse.safeParse(response()).success).toBe(true);
  });

  it('allows a negative balance', () => {
    const overdrawn = {
      accounts: [summary('main', 100, 500), summary('savings', 0, 0)],
      total: { incomeCents: 100, expenseCents: 500, balanceCents: -400 },
    };
    expect(AccountsResponse.safeParse(overdrawn).success).toBe(true);
  });

  it('rejects a balance that is not income minus expense', () => {
    const body = response();
    body.accounts[0]!.balanceCents = 1;
    expect(AccountsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects a total that is not the sum of the accounts', () => {
    const body = response();
    body.total = { incomeCents: 1, expenseCents: 0, balanceCents: 1 };
    expect(AccountsResponse.safeParse(body).success).toBe(false);
  });

  it.each([
    ['a missing account', [summary('main', 0, 0)]],
    ['the wrong order', [summary('savings', 0, 0), summary('main', 0, 0)]],
    ['a duplicate account', [summary('main', 0, 0), summary('main', 0, 0)]],
    ['an unknown account', [summary('main', 0, 0), summary('checking', 0, 0)]],
  ])('rejects %s', (_label, accounts) => {
    const body = { accounts, total: { incomeCents: 0, expenseCents: 0, balanceCents: 0 } };
    expect(AccountsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects negative income or expense totals', () => {
    const body = {
      accounts: [summary('main', -1, 0), summary('savings', 0, 0)],
      total: { incomeCents: -1, expenseCents: 0, balanceCents: -1 },
    };
    expect(AccountsResponse.safeParse(body).success).toBe(false);
  });
});
