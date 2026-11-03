import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { AppDeps } from '../../src/app.js';
import { openDatabase } from '../../src/db/database.js';
import { sequentialIds, steppingClock } from '../fixtures.js';

/** The real app over a fresh in-memory database, with a deterministic clock and ids. */
function setupApi(overrides: Partial<AppDeps> = {}) {
  const db = openDatabase();
  const app = createApp({
    db,
    clock: steppingClock('2026-11-03T10:00:00.000Z'),
    newId: sequentialIds(1000),
    ...overrides,
  });
  return { db, app, api: request(app) };
}

type Api = ReturnType<typeof setupApi>['api'];

const transactionBody = (overrides: Record<string, unknown> = {}) => ({
  account: 'main',
  type: 'expense',
  amountCents: 5_000,
  date: '2026-10-15',
  description: 'Groceries',
  ...overrides,
});

async function createProject(api: Api, body: Record<string, unknown> = {}) {
  const res = await api.post('/api/projects').send({ name: 'Holiday', ...body });
  if (res.status !== 201) throw new Error(`project not created: ${JSON.stringify(res.body)}`);
  return res.body as { id: string; name: string };
}

async function createTransaction(api: Api, body: Record<string, unknown> = {}) {
  const res = await api.post('/api/transactions').send(transactionBody(body));
  if (res.status !== 201) throw new Error(`transaction not created: ${JSON.stringify(res.body)}`);
  return res.body as { id: string };
}

export { createProject, createTransaction, setupApi, transactionBody };
export type { Api };
