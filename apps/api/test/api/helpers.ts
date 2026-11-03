import request from 'supertest';
import type { Express } from 'express';
import type { Database } from 'better-sqlite3';
import { createApp } from '../../src/app.js';
import type { AppDeps } from '../../src/app.js';
import { SESSION_COOKIE_NAME } from '../../src/auth/session-service.js';
import { hashToken } from '../../src/auth/token.js';
import { openDatabase } from '../../src/db/database.js';
import { createSessionRepository } from '../../src/repositories/session-repository.js';
import { createUserRepository } from '../../src/repositories/user-repository.js';
import { sequentialIds, steppingClock, uuid } from '../fixtures.js';

const FAST_SCRYPT = { N: 1024, r: 8, p: 1 } as const;
const DEFAULT_ORIGIN = 'http://localhost:5173';
const DEFAULT_USER_ID = uuid(900);
const DEFAULT_SESSION_TOKEN = 't'.repeat(43);

/** Wraps a supertest agent so every request carries `Origin` and `Cookie` by default. */
function clientWithSession(app: Express, token: string, origin = DEFAULT_ORIGIN) {
  const raw = request(app);
  const cookie = `${SESSION_COOKIE_NAME}=${token}`;
  return {
    get: (url: string) => raw.get(url).set('Cookie', cookie),
    post: (url: string) => raw.post(url).set('Origin', origin).set('Cookie', cookie),
    patch: (url: string) => raw.patch(url).set('Origin', origin).set('Cookie', cookie),
    put: (url: string) => raw.put(url).set('Origin', origin).set('Cookie', cookie),
    delete: (url: string) => raw.delete(url).set('Origin', origin).set('Cookie', cookie),
  };
}

function seedSessionForUser(
  db: Database,
  spec: { id: string; email: string; displayName: string; token: string },
) {
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const farFuture = new Date('2099-01-01T00:00:00.000Z');
  users.insert({
    id: spec.id,
    email: spec.email,
    displayName: spec.displayName,
    passwordHash:
      'scrypt$1024$8$1$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    createdAt,
    updatedAt: createdAt,
  });
  sessions.insert({
    tokenHash: hashToken(spec.token),
    userId: spec.id,
    createdAt,
    lastSeenAt: farFuture,
    expiresAt: farFuture,
  });
}

/**
 * The real app over a fresh in-memory database, with a deterministic clock and ids, and a
 * pre-authenticated default user (`DEFAULT_USER_ID`) so existing domain endpoint tests can
 * call `api.get` / `api.post` directly. Also returns `rawApi` (no cookie or Origin header).
 */
function setupApi(overrides: Partial<AppDeps> = {}) {
  const db = openDatabase();
  seedSessionForUser(db, {
    id: DEFAULT_USER_ID,
    email: 'tester@example.com',
    displayName: 'Test User',
    token: DEFAULT_SESSION_TOKEN,
  });

  const app = createApp({
    db,
    clock: steppingClock('2026-11-03T10:00:00.000Z'),
    authClock: () => new Date('2026-11-03T10:00:00.000Z'),
    newId: sequentialIds(1000),
    scryptParams: FAST_SCRYPT,
    ...overrides,
  });

  return {
    db,
    app,
    userId: DEFAULT_USER_ID,
    api: clientWithSession(app, DEFAULT_SESSION_TOKEN),
    rawApi: request(app),
  };
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

export {
  clientWithSession,
  createProject,
  createTransaction,
  DEFAULT_ORIGIN,
  DEFAULT_SESSION_TOKEN,
  DEFAULT_USER_ID,
  FAST_SCRYPT,
  seedSessionForUser,
  setupApi,
  transactionBody,
};
export type { Api };
