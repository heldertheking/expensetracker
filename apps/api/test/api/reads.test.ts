import {
  AccountsResponse,
  ApiErrorSchema,
  EventListResponse,
  NO_PROJECT_NAME,
  StatsResponse,
} from '@expensetracker/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createTransaction, setupApi } from './helpers.js';
import type { Api } from './helpers.js';

let api: Api;

beforeEach(() => {
  ({ api } = setupApi());
});

describe('GET /api/accounts', () => {
  it('lists both accounts with zeros on an empty database', async () => {
    const res = await api.get('/api/accounts');

    expect(res.status).toBe(200);
    expect(AccountsResponse.parse(res.body).total).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
    });
  });

  it('sums each account and the total', async () => {
    await createTransaction(api, { type: 'income', amountCents: 400_000 });
    await createTransaction(api, { amountCents: 150_000 });
    await createTransaction(api, { account: 'savings', type: 'income', amountCents: 50_000 });

    const res = await api.get('/api/accounts');

    expect(AccountsResponse.parse(res.body)).toEqual({
      accounts: [
        { account: 'main', incomeCents: 400_000, expenseCents: 150_000, balanceCents: 250_000 },
        { account: 'savings', incomeCents: 50_000, expenseCents: 0, balanceCents: 50_000 },
      ],
      total: { incomeCents: 450_000, expenseCents: 150_000, balanceCents: 300_000 },
    });
  });
});

describe('GET /api/stats', () => {
  beforeEach(async () => {
    const holiday = await createProject(api, { name: 'Holiday', budgetCents: 100_000 });
    const bike = await createProject(api, { name: 'Bike' });
    // Before the requested range: counts towards the opening balance only.
    await createTransaction(api, { date: '2026-03-25', type: 'income', amountCents: 500_000 });
    await createTransaction(api, {
      date: '2026-03-28',
      account: 'savings',
      type: 'income',
      amountCents: 100_000,
    });
    // Inside the range (2026-04 to 2026-06), nothing in May.
    await createTransaction(api, { date: '2026-04-02', amountCents: 150_000 });
    await createTransaction(api, { date: '2026-04-10', amountCents: 40_000, projectId: bike.id });
    await createTransaction(api, {
      date: '2026-06-20',
      account: 'savings',
      amountCents: 80_000,
      projectId: holiday.id,
    });
    await createTransaction(api, { date: '2026-06-25', type: 'income', amountCents: 500_000 });
    // After the range: ignored.
    await createTransaction(api, { date: '2026-07-01', amountCents: 999 });
  });

  it('returns flows, balances and expenses per project for the range', async () => {
    const res = await api.get('/api/stats?from=2026-04-15&to=2026-06-01');

    expect(res.status).toBe(200);
    const stats = StatsResponse.parse(res.body);
    expect(stats.from).toBe('2026-04');
    expect(stats.to).toBe('2026-06');
    expect(stats.monthly).toEqual([
      { month: '2026-04', incomeCents: 0, expenseCents: 190_000, netCents: -190_000 },
      { month: '2026-05', incomeCents: 0, expenseCents: 0, netCents: 0 },
      { month: '2026-06', incomeCents: 500_000, expenseCents: 80_000, netCents: 420_000 },
    ]);
    expect(stats.balances).toEqual([
      { month: '2026-04', mainCents: 310_000, savingsCents: 100_000, totalCents: 410_000 },
      { month: '2026-05', mainCents: 310_000, savingsCents: 100_000, totalCents: 410_000 },
      { month: '2026-06', mainCents: 810_000, savingsCents: 20_000, totalCents: 830_000 },
    ]);
    expect(stats.expenseByProject).toEqual([
      { projectId: null, name: NO_PROJECT_NAME, expenseCents: 150_000 },
      { projectId: expect.any(String), name: 'Holiday', expenseCents: 80_000 },
      { projectId: expect.any(String), name: 'Bike', expenseCents: 40_000 },
    ]);
  });

  it('defaults to the 12 months up to the current month of the clock', async () => {
    const stats = StatsResponse.parse((await api.get('/api/stats')).body);

    expect(stats.from).toBe('2025-12');
    expect(stats.to).toBe('2026-11');
    expect(stats.monthly).toHaveLength(12);
    expect(stats.balances.at(-1)!.totalCents).toBe(829_001);
  });

  it.each([
    '?from=2026-01-01',
    '?from=2026-06-01&to=2026-01-01',
    '?from=2020-01-01&to=2026-01-01',
    '?from=2026-02-30&to=2026-03-01',
    '?months=3',
  ])('rejects %s with a validation_error', async (query) => {
    const res = await api.get(`/api/stats${query}`);

    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('validation_error');
  });

  it('accepts a range of exactly 60 months', async () => {
    const res = await api.get('/api/stats?from=2022-01-01&to=2026-12-31');

    expect(res.status).toBe(200);
    expect(StatsResponse.parse(res.body).monthly).toHaveLength(60);
  });
});

describe('GET /api/events', () => {
  beforeEach(async () => {
    const project = await createProject(api);
    const transaction = await createTransaction(api, { projectId: project.id });
    await api.patch(`/api/transactions/${transaction.id}`).send({ description: 'Market' });
    await api.delete(`/api/transactions/${transaction.id}`);
  });

  const list = async (query = '') => {
    const res = await api.get(`/api/events${query}`);
    expect(res.status).toBe(200);
    return EventListResponse.parse(res.body);
  };

  it('lists the event log newest first', async () => {
    const page = await list();

    expect(page.items.map((e) => [e.sequence, e.type])).toEqual([
      [4, 'DeleteTransactionEvent'],
      [3, 'UpdateTransactionEvent'],
      [2, 'CreateTransactionEvent'],
      [1, 'CreateProjectEvent'],
    ]);
    expect(page).toMatchObject({ total: 4, limit: 20, offset: 0 });
  });

  it('filters by type and pages', async () => {
    expect((await list('?type=UpdateTransactionEvent')).items.map((e) => e.sequence)).toEqual([3]);
    expect(await list('?limit=1&offset=1')).toMatchObject({ total: 4, items: [{ sequence: 3 }] });
    expect(await list('?offset=9')).toMatchObject({ total: 4, items: [] });
  });

  it.each(['?type=Unknown', '?limit=0', '?offset=-1'])('rejects %s', async (query) => {
    expect((await api.get(`/api/events${query}`)).status).toBe(400);
  });
});
