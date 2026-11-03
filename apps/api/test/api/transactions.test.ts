import {
  ApiErrorSchema,
  EventListResponse,
  TransactionListResponse,
  TransactionResponse,
} from '@expensetracker/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { uuid } from '../fixtures.js';
import { createProject, createTransaction, setupApi, transactionBody } from './helpers.js';
import type { Api } from './helpers.js';

let api: Api;

beforeEach(() => {
  ({ api } = setupApi());
});

const errorOf = (body: unknown) => ApiErrorSchema.parse(body).error;

async function events() {
  const res = await api.get('/api/events');
  return EventListResponse.parse(res.body).items;
}

describe('POST /api/transactions', () => {
  it('creates a transaction (201) and records a CreateTransactionEvent', async () => {
    const res = await api.post('/api/transactions').send(transactionBody());

    expect(res.status).toBe(201);
    const created = TransactionResponse.parse(res.body);
    expect(created).toEqual({
      id: uuid(1000),
      account: 'main',
      type: 'expense',
      amountCents: 5_000,
      date: '2026-10-15',
      description: 'Groceries',
      projectId: null,
      createdAt: new Date('2026-11-03T10:00:00.000Z'),
      updatedAt: new Date('2026-11-03T10:00:00.000Z'),
    });
    expect(await events()).toEqual([
      expect.objectContaining({
        type: 'CreateTransactionEvent',
        payload: { transaction: created },
      }),
    ]);
  });

  it('tags a transaction with an existing project', async () => {
    const project = await createProject(api);

    const res = await api
      .post('/api/transactions')
      .send(transactionBody({ projectId: project.id }));

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe(project.id);
  });

  it('rejects a tag of an unknown project with 422 and stores nothing', async () => {
    const res = await api.post('/api/transactions').send(transactionBody({ projectId: uuid(1) }));

    expect(res.status).toBe(422);
    expect(errorOf(res.body)).toMatchObject({
      code: 'unprocessable',
      issues: [{ path: 'projectId' }],
    });
    expect(await events()).toEqual([]);
  });

  it.each([
    [{ account: undefined }, 'account'],
    [{ account: 'checking' }, 'account'],
    [{ amountCents: 12.5 }, 'amountCents'],
    [{ amountCents: -1 }, 'amountCents'],
    [{ date: '2026-13-01' }, 'date'],
    [{ date: '1999-12-31' }, 'date'],
    [{ date: '2999-01-01' }, 'date'],
    [{ description: '   ' }, 'description'],
    [{ id: uuid(1) }, 'id'],
  ])('rejects %j with a validation_error on %s', async (override, path) => {
    const res = await api.post('/api/transactions').send(transactionBody(override));

    expect(res.status).toBe(400);
    expect(errorOf(res.body).issues.map((i) => i.path)).toEqual([path]);
  });
});

describe('GET /api/transactions', () => {
  let holiday: { id: string };

  beforeEach(async () => {
    holiday = await createProject(api);
    await createTransaction(api, { date: '2026-08-01', type: 'income', amountCents: 500_000 });
    await createTransaction(api, { date: '2026-09-01', projectId: holiday.id });
    await createTransaction(api, { date: '2026-09-15', account: 'savings', type: 'income' });
    await createTransaction(api, { date: '2026-10-01' });
  });

  const list = async (query: string) => {
    const res = await api.get(`/api/transactions${query}`);
    expect(res.status).toBe(200);
    return TransactionListResponse.parse(res.body);
  };

  it('lists newest first with the default page', async () => {
    const page = await list('');

    expect(page.items.map((t) => t.date)).toEqual([
      '2026-10-01',
      '2026-09-15',
      '2026-09-01',
      '2026-08-01',
    ]);
    expect(page).toMatchObject({ total: 4, limit: 50, offset: 0 });
  });

  it.each([
    ['?account=savings', ['2026-09-15']],
    ['?type=income', ['2026-09-15', '2026-08-01']],
    ['?from=2026-09-01&to=2026-09-30', ['2026-09-15', '2026-09-01']],
    ['?account=main&type=expense', ['2026-10-01', '2026-09-01']],
  ])('filters with %s', async (query, dates) => {
    expect((await list(query)).items.map((t) => t.date)).toEqual(dates);
  });

  it('filters by project', async () => {
    const page = await list(`?projectId=${holiday.id}`);

    expect(page.items.map((t) => t.date)).toEqual(['2026-09-01']);
    expect(page.total).toBe(1);
  });

  it('pages with limit and offset', async () => {
    const page = await list('?limit=2&offset=1');

    expect(page.items.map((t) => t.date)).toEqual(['2026-09-15', '2026-09-01']);
    expect(page).toMatchObject({ total: 4, limit: 2, offset: 1 });
  });

  it('returns an empty page past the end with the real total', async () => {
    const page = await list('?offset=10');

    expect(page).toEqual({ items: [], total: 4, limit: 50, offset: 10 });
  });

  it.each(['?limit=0', '?limit=101', '?account=all', '?from=2026-10-01&to=2026-09-01', '?x=1'])(
    'rejects %s with a validation_error',
    async (query) => {
      const res = await api.get(`/api/transactions${query}`);

      expect(res.status).toBe(400);
      expect(errorOf(res.body).code).toBe('validation_error');
    },
  );
});

describe('GET /api/transactions/:id', () => {
  it('returns one transaction', async () => {
    const created = await createTransaction(api);

    const res = await api.get(`/api/transactions/${created.id}`);

    expect(res.status).toBe(200);
    expect(TransactionResponse.parse(res.body).id).toBe(created.id);
  });

  it('answers an unknown id with 404 and a malformed one with 400', async () => {
    expect((await api.get(`/api/transactions/${uuid(1)}`)).status).toBe(404);
    expect((await api.get('/api/transactions/123')).status).toBe(400);
  });
});

describe('PATCH /api/transactions/:id', () => {
  it('updates the sent fields and records before and after', async () => {
    const project = await createProject(api);
    const created = await createTransaction(api);

    const res = await api
      .patch(`/api/transactions/${created.id}`)
      .send({ description: 'Market', projectId: project.id });

    expect(res.status).toBe(200);
    const updated = TransactionResponse.parse(res.body);
    expect(updated).toMatchObject({
      description: 'Market',
      projectId: project.id,
      amountCents: 5_000,
    });
    expect((await events())[0]).toMatchObject({
      type: 'UpdateTransactionEvent',
      payload: {
        before: { description: 'Groceries', projectId: null },
        after: { description: 'Market', projectId: project.id },
      },
    });
  });

  it('flips the type when the amount is sent again', async () => {
    const created = await createTransaction(api);

    const res = await api
      .patch(`/api/transactions/${created.id}`)
      .send({ type: 'income', amountCents: 5_000 });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('income');
  });

  it('requires the amount when the type changes', async () => {
    const created = await createTransaction(api);

    const res = await api.patch(`/api/transactions/${created.id}`).send({ type: 'income' });

    expect(res.status).toBe(400);
    expect(errorOf(res.body).issues[0]!.path).toBe('amountCents');
  });

  it('refuses to change the account', async () => {
    const created = await createTransaction(api);

    const res = await api.patch(`/api/transactions/${created.id}`).send({ account: 'savings' });

    expect(res.status).toBe(400);
    expect(errorOf(res.body).issues.map((i) => i.path)).toContain('account');
  });

  it('rejects an update that changes nothing', async () => {
    const created = await createTransaction(api);

    const res = await api.patch(`/api/transactions/${created.id}`).send({ amountCents: 5_000 });

    expect(res.status).toBe(400);
  });

  it('rejects a tag of an unknown project with 422', async () => {
    const created = await createTransaction(api);

    const res = await api.patch(`/api/transactions/${created.id}`).send({ projectId: uuid(1) });

    expect(res.status).toBe(422);
  });

  it('answers an unknown id with 404', async () => {
    const res = await api.patch(`/api/transactions/${uuid(1)}`).send({ description: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('deletes the transaction (204) and records it', async () => {
    const created = await createTransaction(api);

    const res = await api.delete(`/api/transactions/${created.id}`);

    expect(res.status).toBe(204);
    expect((await api.get(`/api/transactions/${created.id}`)).status).toBe(404);
    expect((await events())[0]).toMatchObject({
      type: 'DeleteTransactionEvent',
      payload: { transaction: { id: created.id } },
    });
  });

  it('answers an unknown id with 404', async () => {
    expect((await api.delete(`/api/transactions/${uuid(1)}`)).status).toBe(404);
  });
});
