import { NO_PROJECT_NAME, StatsResponse } from '@expensetracker/schema';
import { describe, expect, it } from 'vitest';
import { buildStats, statsRange } from '../../src/services/statistics.js';
import type { MonthlyTotal } from '../../src/repositories/transaction-repository.js';
import { uuid } from '../fixtures.js';

describe('statsRange', () => {
  it('defaults to the 12 months up to and including the current month', () => {
    expect(statsRange({}, new Date('2026-11-03T10:00:00Z'))).toEqual({
      from: '2025-12',
      to: '2026-11',
      firstDay: '2025-12-01',
      lastDay: '2026-11-30',
    });
  });

  it('crosses the year boundary in January', () => {
    expect(statsRange({}, new Date('2027-01-15T00:00:00Z'))).toMatchObject({
      from: '2026-02',
      to: '2027-01',
    });
  });

  it('covers the whole months that from and to fall in', () => {
    expect(statsRange({ from: '2026-02-14', to: '2026-04-02' }, new Date())).toEqual({
      from: '2026-02',
      to: '2026-04',
      firstDay: '2026-02-01',
      lastDay: '2026-04-30',
    });
  });

  it('knows the length of February in leap years', () => {
    expect(statsRange({ from: '2028-02-01', to: '2028-02-01' }, new Date()).lastDay).toBe(
      '2028-02-29',
    );
    expect(statsRange({ from: '2026-02-01', to: '2026-02-01' }, new Date()).lastDay).toBe(
      '2026-02-28',
    );
  });
});

describe('buildStats', () => {
  const range = () => statsRange({ from: '2026-04-01', to: '2026-06-30' }, new Date());
  const total = (
    month: string,
    account: MonthlyTotal['account'],
    type: MonthlyTotal['type'],
    totalCents: number,
  ): MonthlyTotal => ({ month, account, type, totalCents });

  it('lists every month of the range with gaps as 0', () => {
    const stats = buildStats(range(), [total('2026-05', 'main', 'income', 1_000)], []);

    expect(stats.from).toBe('2026-04');
    expect(stats.to).toBe('2026-06');
    expect(stats.monthly).toEqual([
      { month: '2026-04', incomeCents: 0, expenseCents: 0, netCents: 0 },
      { month: '2026-05', incomeCents: 1_000, expenseCents: 0, netCents: 1_000 },
      { month: '2026-06', incomeCents: 0, expenseCents: 0, netCents: 0 },
    ]);
  });

  it('adds both accounts into the monthly flow', () => {
    const stats = buildStats(
      range(),
      [
        total('2026-04', 'main', 'income', 500_000),
        total('2026-04', 'main', 'expense', 300_000),
        total('2026-04', 'savings', 'income', 50_000),
        total('2026-04', 'savings', 'expense', 10_000),
      ],
      [{ projectId: null, name: null, expenseCents: 310_000 }],
    );

    expect(stats.monthly[0]).toEqual({
      month: '2026-04',
      incomeCents: 550_000,
      expenseCents: 310_000,
      netCents: 240_000,
    });
  });

  it('starts the balances with everything booked before the range', () => {
    const stats = buildStats(
      range(),
      [
        total('2025-01', 'main', 'income', 100_000),
        total('2026-03', 'savings', 'income', 20_000),
        total('2026-03', 'main', 'expense', 30_000),
        total('2026-04', 'main', 'expense', 5_000),
        total('2026-06', 'savings', 'expense', 1_000),
      ],
      [{ projectId: null, name: null, expenseCents: 6_000 }],
    );

    expect(stats.balances).toEqual([
      { month: '2026-04', mainCents: 65_000, savingsCents: 20_000, totalCents: 85_000 },
      { month: '2026-05', mainCents: 65_000, savingsCents: 20_000, totalCents: 85_000 },
      { month: '2026-06', mainCents: 65_000, savingsCents: 19_000, totalCents: 84_000 },
    ]);
  });

  it('ignores months after the range for the balances', () => {
    const stats = buildStats(range(), [total('2026-07', 'main', 'income', 1)], []);

    expect(stats.balances.at(-1)?.totalCents).toBe(0);
    expect(stats.monthly.at(-1)?.incomeCents).toBe(0);
  });

  it('names the untagged expenses and orders projects largest first, then by name', () => {
    const stats = buildStats(
      range(),
      [total('2026-05', 'main', 'expense', 600)],
      [
        { projectId: uuid(1), name: 'Bike', expenseCents: 100 },
        { projectId: null, name: null, expenseCents: 300 },
        { projectId: uuid(2), name: 'Holiday', expenseCents: 100 },
        { projectId: uuid(3), name: 'Attic', expenseCents: 100 },
      ],
    );

    expect(stats.expenseByProject).toEqual([
      { projectId: null, name: NO_PROJECT_NAME, expenseCents: 300 },
      { projectId: uuid(3), name: 'Attic', expenseCents: 100 },
      { projectId: uuid(1), name: 'Bike', expenseCents: 100 },
      { projectId: uuid(2), name: 'Holiday', expenseCents: 100 },
    ]);
  });

  it('drops project rows without expenses', () => {
    const stats = buildStats(range(), [], [{ projectId: uuid(1), name: 'Bike', expenseCents: 0 }]);

    expect(stats.expenseByProject).toEqual([]);
  });

  it('satisfies the StatsResponse contract', () => {
    const stats = buildStats(
      statsRange({}, new Date('2026-11-03T00:00:00Z')),
      [
        total('2025-06', 'main', 'income', 1_000_000),
        total('2026-01', 'main', 'expense', 250_000),
        total('2026-02', 'savings', 'income', 50_000),
        total('2026-11', 'main', 'expense', 50_000),
      ],
      [
        { projectId: uuid(1), name: 'Bike', expenseCents: 250_000 },
        { projectId: null, name: null, expenseCents: 50_000 },
      ],
    );

    expect(stats.monthly).toHaveLength(12);
    expect(StatsResponse.safeParse(stats).success).toBe(true);
  });
});
