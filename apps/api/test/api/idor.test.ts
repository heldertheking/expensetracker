import {
  AccountsResponse,
  EventListResponse,
  ProjectListResponse,
  StatsResponse,
  TransactionListResponse,
} from '@expensetracker/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { uuid } from '../fixtures.js';
import {
  clientWithSession,
  createProject,
  createTransaction,
  seedSessionForUser,
  setupApi,
  transactionBody,
} from './helpers.js';
import type { Api } from './helpers.js';

const USER_B_ID = uuid(901);
const USER_B_TOKEN = 'u'.repeat(43);

describe('multi-user data isolation (IDOR prevention)', () => {
  let aliceApi: Api;
  let bobApi: Api;
  let aliceProject: { id: string; name: string };
  let aliceTransaction: { id: string };

  beforeEach(async () => {
    const { db, app, api } = setupApi();
    aliceApi = api;
    seedSessionForUser(db, {
      id: USER_B_ID,
      email: 'bob@example.com',
      displayName: 'Bob',
      token: USER_B_TOKEN,
    });
    bobApi = clientWithSession(app, USER_B_TOKEN);

    aliceProject = await createProject(aliceApi, {
      name: 'Alice Secret Project',
      budgetCents: 100_000,
    });
    aliceTransaction = await createTransaction(aliceApi, {
      account: 'main',
      type: 'expense',
      amountCents: 25_000,
      date: '2026-10-15',
      description: 'Alice Rent',
      projectId: aliceProject.id,
    });
  });

  it('prevents User B from reading, updating or deleting User A projects', async () => {
    expect((await bobApi.get(`/api/projects/${aliceProject.id}`)).status).toBe(404);
    expect(
      (await bobApi.patch(`/api/projects/${aliceProject.id}`).send({ name: 'Hijacked' })).status,
    ).toBe(404);
    expect((await bobApi.delete(`/api/projects/${aliceProject.id}`)).status).toBe(404);

    // Alice's project is untouched
    const check = await aliceApi.get(`/api/projects/${aliceProject.id}`);
    expect(check.status).toBe(200);
    expect(check.body.name).toBe('Alice Secret Project');

    // Bob's project list is empty
    const bobList = ProjectListResponse.parse((await bobApi.get('/api/projects')).body);
    expect(bobList.items).toEqual([]);
  });

  it('allows User B to create a project with the exact same name as User A', async () => {
    const res = await bobApi
      .post('/api/projects')
      .send({ name: 'Alice Secret Project', budgetCents: 50_000 });
    expect(res.status).toBe(201);
  });

  it('prevents User B from reading, updating or deleting User A transactions', async () => {
    expect((await bobApi.get(`/api/transactions/${aliceTransaction.id}`)).status).toBe(404);
    expect(
      (
        await bobApi
          .patch(`/api/transactions/${aliceTransaction.id}`)
          .send({ description: 'Hijacked' })
      ).status,
    ).toBe(404);
    expect((await bobApi.delete(`/api/transactions/${aliceTransaction.id}`)).status).toBe(404);

    // Bob cannot list Alice's transactions, even when filtering by Alice's projectId
    const bobList = TransactionListResponse.parse(
      (await bobApi.get(`/api/transactions?projectId=${aliceProject.id}`)).body,
    );
    expect(bobList).toMatchObject({ items: [], total: 0 });
  });

  it('prevents User B from tagging a transaction with User A projectId (422 unprocessable)', async () => {
    const createRes = await bobApi
      .post('/api/transactions')
      .send(transactionBody({ projectId: aliceProject.id }));
    expect(createRes.status).toBe(422);

    const bobTx = await createTransaction(bobApi, { description: 'Bob Coffee' });
    const patchRes = await bobApi
      .patch(`/api/transactions/${bobTx.id}`)
      .send({ projectId: aliceProject.id });
    expect(patchRes.status).toBe(422);
  });

  it('scopes accounts, stats and events strictly to the authenticated user', async () => {
    const bobAccounts = AccountsResponse.parse((await bobApi.get('/api/accounts')).body);
    expect(bobAccounts.total).toEqual({ incomeCents: 0, expenseCents: 0, balanceCents: 0 });

    const bobStats = StatsResponse.parse((await bobApi.get('/api/stats')).body);
    expect(bobStats.expenseByProject).toEqual([]);
    expect(bobStats.balances.at(-1)?.totalCents).toBe(0);

    const bobEvents = EventListResponse.parse((await bobApi.get('/api/events')).body);
    expect(bobEvents.items).toEqual([]);
    expect(bobEvents.total).toBe(0);
  });
});
