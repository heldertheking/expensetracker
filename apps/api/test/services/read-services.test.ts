import { describe, expect, it, vi } from 'vitest';
import { ApiFailure } from '../../src/errors.js';
import {
  createAccountService,
  createEventService,
  createProjectService,
  createStatsService,
  createTransactionService,
  sumsOf,
} from '../../src/services/read-services.js';
import { makeProject, makeTransaction, uuid } from '../fixtures.js';

const USER_ID = uuid(900);

describe('sumsOf', () => {
  it('adds up the income and expense rows of one project only', () => {
    expect(
      sumsOf(
        [
          { projectId: uuid(1), type: 'expense', totalCents: 10 },
          { projectId: uuid(1), type: 'income', totalCents: 3 },
          { projectId: uuid(2), type: 'expense', totalCents: 99 },
        ],
        uuid(1),
      ),
    ).toEqual({ incomeCents: 3, expenseCents: 10 });
  });
});

describe('account service', () => {
  it('builds the summary from the sums of the repository for that user', () => {
    const totalsByAccount = vi.fn(() => [
      { account: 'main' as const, type: 'income' as const, totalCents: 10 },
    ]);
    const service = createAccountService({ transactions: { totalsByAccount } });

    expect(service.summary(USER_ID).total).toEqual({
      incomeCents: 10,
      expenseCents: 0,
      balanceCents: 10,
    });
    expect(totalsByAccount).toHaveBeenCalledWith(USER_ID);
  });
});

describe('project service', () => {
  const holiday = makeProject({ id: uuid(1), name: 'Holiday', budgetCents: 1_000 });
  const bike = makeProject({ id: uuid(2), name: 'Bike', budgetCents: null });
  const deps = () => ({
    projects: {
      list: vi.fn(() => [bike, holiday]),
      findById: vi.fn((_userId: string, id: string) => [bike, holiday].find((p) => p.id === id)),
    },
    transactions: {
      totalsByProject: vi.fn(() => [
        { projectId: uuid(1), type: 'expense' as const, totalCents: 1_500 },
        { projectId: uuid(2), type: 'income' as const, totalCents: 7 },
      ]),
    },
  });

  it('lists every project with its totals', () => {
    const projects = createProjectService(deps()).list(USER_ID);

    expect(projects.map((p) => [p.name, p.remainingCents, p.overBudget])).toEqual([
      ['Bike', null, false],
      ['Holiday', -500, true],
    ]);
    expect(projects[0]!.incomeCents).toBe(7);
  });

  it('gets one project with its totals', () => {
    expect(createProjectService(deps()).get(USER_ID, uuid(1)).expenseCents).toBe(1_500);
  });

  it('throws not_found for an unknown project', () => {
    expect(() => createProjectService(deps()).get(USER_ID, uuid(9))).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    );
  });
});

describe('transaction service', () => {
  const transaction = makeTransaction();

  it('passes userId and query to the repository and returns the page with its paging', () => {
    const list = vi.fn(() => ({ items: [transaction], total: 3 }));
    const service = createTransactionService({ transactions: { list, findById: vi.fn() } });
    const query = { account: 'main' as const, limit: 1, offset: 2 };

    expect(service.list(USER_ID, query)).toEqual({
      items: [transaction],
      total: 3,
      limit: 1,
      offset: 2,
    });
    expect(list).toHaveBeenCalledWith(USER_ID, query);
  });

  it('gets one transaction or throws not_found', () => {
    const findById = vi.fn((_userId: string, id: string) =>
      id === transaction.id ? transaction : undefined,
    );
    const service = createTransactionService({ transactions: { list: vi.fn(), findById } });

    expect(service.get(USER_ID, transaction.id)).toBe(transaction);
    expect(() => service.get(USER_ID, uuid(9))).toThrow(ApiFailure);
  });
});

describe('event service', () => {
  it('returns the page of the repository with its paging', () => {
    const list = vi.fn(() => ({ items: [], total: 0 }));

    expect(
      createEventService({ events: { list } }).list(USER_ID, {
        type: 'CreateProjectEvent',
        limit: 5,
        offset: 0,
      }),
    ).toEqual({ items: [], total: 0, limit: 5, offset: 0 });
    expect(list).toHaveBeenCalledWith(USER_ID, {
      type: 'CreateProjectEvent',
      limit: 5,
      offset: 0,
    });
  });
});

describe('stats service', () => {
  it('reads the sums for the default range from the clock', () => {
    const monthlyTotals = vi.fn(() => []);
    const expenseByProject = vi.fn(() => []);
    const service = createStatsService({
      transactions: { monthlyTotals, expenseByProject },
      clock: () => new Date('2026-11-03T10:00:00Z'),
    });

    const stats = service.stats(USER_ID, {});

    expect(stats.from).toBe('2025-12');
    expect(stats.to).toBe('2026-11');
    expect(monthlyTotals).toHaveBeenCalledWith(USER_ID, '2026-11-30');
    expect(expenseByProject).toHaveBeenCalledWith(USER_ID, '2025-12-01', '2026-11-30');
  });

  it('uses the whole months of the requested range', () => {
    const expenseByProject = vi.fn(() => []);
    const service = createStatsService({
      transactions: { monthlyTotals: vi.fn(() => []), expenseByProject },
      clock: () => new Date(),
    });

    expect(service.stats(USER_ID, { from: '2026-01-15', to: '2026-02-10' }).monthly).toHaveLength(
      2,
    );
    expect(expenseByProject).toHaveBeenCalledWith(USER_ID, '2026-01-01', '2026-02-28');
  });
});
