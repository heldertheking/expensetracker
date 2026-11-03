import { describe, expect, it } from 'vitest';
import { monthsInRange, StatsQuery, StatsResponse, YearMonth } from '../src/index.js';

const flow = (month: string, incomeCents: number, expenseCents: number) => ({
  month,
  incomeCents,
  expenseCents,
  netCents: incomeCents - expenseCents,
});

const balance = (month: string, mainCents: number, savingsCents: number) => ({
  month,
  mainCents,
  savingsCents,
  totalCents: mainCents + savingsCents,
});

const stats = () => ({
  from: '2026-04',
  to: '2026-06',
  monthly: [flow('2026-04', 500_000, 300_000), flow('2026-05', 0, 0), flow('2026-06', 0, 20_000)],
  balances: [
    balance('2026-04', 150_000, 50_000),
    balance('2026-05', 150_000, 50_000),
    balance('2026-06', 130_000, 50_000),
  ],
  expenseByProject: [
    { projectId: null, name: 'No project', expenseCents: 200_000 },
    { projectId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', name: 'Holiday', expenseCents: 120_000 },
  ],
});

describe('YearMonth', () => {
  it.each(['2026-01', '2026-12'])('accepts %s', (month) => {
    expect(YearMonth.safeParse(month).success).toBe(true);
  });

  it.each(['2026-00', '2026-13', '2026-1', '2026-01-01'])('rejects %s', (month) => {
    expect(YearMonth.safeParse(month).success).toBe(false);
  });
});

describe('monthsInRange', () => {
  it.each([
    ['2026-06', '2026-06', 1],
    ['2025-11', '2026-02', 4],
    ['2026-01-31', '2026-03-01', 3],
  ])('counts %s to %s as %i months', (from, to, months) => {
    expect(monthsInRange(from, to)).toBe(months);
  });
});

describe('StatsQuery', () => {
  it('accepts an empty query so the server picks the default range', () => {
    expect(StatsQuery.parse({})).toEqual({});
  });

  it('requires both ends of the range or neither', () => {
    expect(StatsQuery.safeParse({ from: '2026-01-01' }).success).toBe(false);
    expect(StatsQuery.safeParse({ to: '2026-01-01' }).success).toBe(false);
  });

  it('accepts at most 60 months', () => {
    expect(StatsQuery.safeParse({ from: '2021-07-01', to: '2026-06-30' }).success).toBe(true);
    expect(StatsQuery.safeParse({ from: '2021-06-30', to: '2026-06-01' }).success).toBe(false);
  });

  it('rejects from after to and unknown parameters', () => {
    expect(StatsQuery.safeParse({ from: '2026-06-02', to: '2026-06-01' }).success).toBe(false);
    expect(StatsQuery.safeParse({ account: 'main' }).success).toBe(false);
  });
});

describe('StatsResponse', () => {
  it('accepts consistent statistics', () => {
    expect(StatsResponse.safeParse(stats()).success).toBe(true);
  });

  it('accepts a single month without any expenses', () => {
    const single = {
      from: '2026-06',
      to: '2026-06',
      monthly: [flow('2026-06', 0, 0)],
      balances: [balance('2026-06', 0, 0)],
      expenseByProject: [],
    };
    expect(StatsResponse.safeParse(single).success).toBe(true);
  });

  it('rejects a response without months', () => {
    const empty = {
      from: '2026-06',
      to: '2026-06',
      monthly: [],
      balances: [],
      expenseByProject: [],
    };
    expect(StatsResponse.safeParse(empty).success).toBe(false);
  });

  it('allows negative balances and net flows', () => {
    const body = stats();
    body.monthly[2] = flow('2026-06', 0, 900_000);
    body.balances[2] = balance('2026-06', -750_000, 50_000);
    body.expenseByProject[0]!.expenseCents = 1_080_000;
    expect(StatsResponse.safeParse(body).success).toBe(true);
  });

  it('rejects a net flow that is not income minus expense', () => {
    const body = stats();
    body.monthly[0]!.netCents = 0;
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects a total that is not main plus savings', () => {
    const body = stats();
    body.balances[0]!.totalCents = 0;
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects months out of order', () => {
    const body = stats();
    body.monthly.reverse();
    body.balances.reverse();
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects balances for other months than the flows', () => {
    const body = stats();
    body.balances.pop();
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects months that do not span from to to', () => {
    const body = { ...stats(), to: '2026-07' };
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects a skipped month', () => {
    const body = stats();
    body.monthly.splice(1, 1);
    body.balances.splice(1, 1);
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects balances that do not follow the net flow', () => {
    const body = stats();
    body.balances[2] = balance('2026-06', 150_000, 50_000); // the net flow was -20_000
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects the same project twice', () => {
    const body = stats();
    body.expenseByProject = [
      { projectId: null, name: 'No project', expenseCents: 160_000 },
      { projectId: null, name: 'No project', expenseCents: 160_000 },
    ];
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects project expenses that do not add up to the monthly expenses', () => {
    const body = stats();
    body.expenseByProject[1]!.expenseCents = 100_000;
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('orders projects with equal expenses by name', () => {
    const body = stats();
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    body.expenseByProject = [
      { projectId: id, name: 'Holiday', expenseCents: 160_000 },
      { projectId: null, name: 'No project', expenseCents: 160_000 },
    ];
    expect(StatsResponse.safeParse(body).success).toBe(true);
    body.expenseByProject.reverse();
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects projects not ordered largest first', () => {
    const body = stats();
    body.expenseByProject.reverse();
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });

  it('rejects a project row without expenses', () => {
    const body = stats();
    body.expenseByProject.push({ projectId: null, name: 'x', expenseCents: 0 });
    expect(StatsResponse.safeParse(body).success).toBe(false);
  });
});
