import type { Database } from 'better-sqlite3';
import {
  BusinessEventSchema,
  ProjectRecordSchema,
  TransactionSchema,
  UserSchema,
} from '@expensetracker/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../../src/auth/token.js';
import { openDatabase } from '../../src/db/database.js';
import { createEventRepository } from '../../src/repositories/event-repository.js';
import type { EventRepository } from '../../src/repositories/event-repository.js';
import { createProjectRepository } from '../../src/repositories/project-repository.js';
import type { ProjectRepository } from '../../src/repositories/project-repository.js';
import { createSessionRepository } from '../../src/repositories/session-repository.js';
import type { SessionRepository } from '../../src/repositories/session-repository.js';
import { createTransactionRepository } from '../../src/repositories/transaction-repository.js';
import type { TransactionRepository } from '../../src/repositories/transaction-repository.js';
import { createUserRepository } from '../../src/repositories/user-repository.js';
import type { UserRepository } from '../../src/repositories/user-repository.js';
import { makeProject, makeTransaction, uuid } from '../fixtures.js';

const USER_A = uuid(900);
const USER_B = uuid(901);
const CREATED_AT = new Date('2026-11-01T08:00:00.000Z');

let db: Database;
let users: UserRepository;
let sessions: SessionRepository;
let projects: ProjectRepository;
let transactions: TransactionRepository;
let events: EventRepository;

beforeEach(() => {
  db = openDatabase();
  users = createUserRepository(db);
  sessions = createSessionRepository(db);
  projects = createProjectRepository(db);
  transactions = createTransactionRepository(db);
  events = createEventRepository(db);

  users.insert({
    id: USER_A,
    email: 'alice@example.com',
    displayName: 'Alice',
    passwordHash: 'scrypt$1024$8$1$aaaa$bbbb',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  users.insert({
    id: USER_B,
    email: 'bob@example.com',
    displayName: 'Bob',
    passwordHash: 'scrypt$1024$8$1$cccc$dddd',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
});

afterEach(() => db.close());

describe('user repository', () => {
  it('inserts a user with normalised email and never exposes password_hash on User', () => {
    const created = users.insert({
      id: uuid(902),
      email: '  Carol@Example.COM ',
      displayName: 'Carol',
      passwordHash: 'scrypt$1024$8$1$eeee$ffff',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });

    expect(created.email).toBe('carol@example.com');
    expect('passwordHash' in created).toBe(false);
    expect('password_hash' in created).toBe(false);
    expect(UserSchema.parse(created)).toEqual(created);
    expect(users.findById(created.id)).toEqual(created);
    expect(users.findById(uuid(999))).toBeUndefined();
    expect(users.count()).toBe(3);
  });

  it('finds credentials by email case-insensitively and updates the password hash', () => {
    const found = users.findByEmail('ALICE@example.com');
    expect(found?.user.id).toBe(USER_A);
    expect(found?.passwordHash).toBe('scrypt$1024$8$1$aaaa$bbbb');
    expect(users.findByEmail('nobody@example.com')).toBeUndefined();

    const updatedAt = new Date('2026-11-02T00:00:00.000Z');
    users.updatePasswordHash(USER_A, 'scrypt$2048$8$1$1111$2222', updatedAt);
    expect(users.findByEmail('alice@example.com')?.passwordHash).toBe('scrypt$2048$8$1$1111$2222');
  });
});

describe('session repository', () => {
  const hash1 = hashToken('a'.repeat(43));
  const hash2 = hashToken('b'.repeat(43));

  it('inserts, touches and deletes sessions by hash, user or expiry', () => {
    const expiresAt = new Date('2026-11-08T08:00:00.000Z');
    sessions.insert({
      tokenHash: hash1,
      userId: USER_A,
      createdAt: CREATED_AT,
      lastSeenAt: CREATED_AT,
      expiresAt,
    });
    sessions.insert({
      tokenHash: hash2,
      userId: USER_A,
      createdAt: CREATED_AT,
      lastSeenAt: CREATED_AT,
      expiresAt,
    });

    expect(sessions.findByTokenHash(hash1)?.userId).toBe(USER_A);
    const later = new Date('2026-11-01T08:05:00.000Z');
    sessions.touchLastSeen(hash1, later);
    expect(sessions.findByTokenHash(hash1)?.lastSeenAt).toEqual(later);

    sessions.deleteByTokenHash(hash1);
    expect(sessions.findByTokenHash(hash1)).toBeUndefined();

    expect(
      sessions.deleteExpired(
        new Date('2026-11-01T09:00:00.000Z'),
        new Date('2026-11-01T08:30:00.000Z'),
      ),
    ).toBe(1);
    expect(sessions.findByTokenHash(hash2)).toBeUndefined();

    sessions.insert({
      tokenHash: hash1,
      userId: USER_A,
      createdAt: CREATED_AT,
      lastSeenAt: CREATED_AT,
      expiresAt,
    });
    sessions.deleteByUserId(USER_A);
    expect(sessions.findByTokenHash(hash1)).toBeUndefined();
  });
});

describe('project repository', () => {
  it('inserts a project and reads it back as a schema-valid record', () => {
    const project = makeProject({ budgetCents: null });
    projects.insert(USER_A, project);

    const found = projects.findById(USER_A, project.id);
    expect(found).toEqual(project);
    expect(ProjectRecordSchema.parse(found)).toEqual(project);
    expect(projects.findById(USER_B, project.id)).toBeUndefined();
  });

  it('returns undefined for an unknown id or name', () => {
    expect(projects.findById(USER_A, uuid(999))).toBeUndefined();
    expect(projects.findByName(USER_A, 'nothing')).toBeUndefined();
  });

  it('finds a project by name ignoring case within the same user', () => {
    projects.insert(USER_A, makeProject({ name: 'Holiday' }));

    expect(projects.findByName(USER_A, 'HOLIDAY')?.name).toBe('Holiday');
    expect(projects.findByName(USER_B, 'HOLIDAY')).toBeUndefined();
  });

  it('rejects a second project with the same name for the same user, but allows another user to use it', () => {
    projects.insert(USER_A, makeProject({ id: uuid(1), name: 'Holiday' }));

    expect(() => projects.insert(USER_A, makeProject({ id: uuid(2), name: 'holiday' }))).toThrow(
      /UNIQUE/,
    );
    expect(() =>
      projects.insert(USER_B, makeProject({ id: uuid(3), name: 'Holiday' })),
    ).not.toThrow();
  });

  it('lists projects by name for the given user only', () => {
    projects.insert(USER_A, makeProject({ id: uuid(1), name: 'zoo' }));
    projects.insert(USER_A, makeProject({ id: uuid(2), name: 'Bike' }));
    projects.insert(USER_B, makeProject({ id: uuid(3), name: 'Other' }));

    expect(projects.list(USER_A).map((p) => p.name)).toEqual(['Bike', 'zoo']);
    expect(projects.count(USER_A)).toBe(2);
    expect(projects.count(USER_B)).toBe(1);
  });

  it('updates name, description and updatedAt for the owning user only and never the budget', () => {
    const project = makeProject();
    projects.insert(USER_A, project);
    const updatedAt = new Date('2026-11-02T00:00:00.000Z');

    projects.update(USER_B, { ...project, name: 'Hacked', updatedAt });
    expect(projects.findById(USER_A, project.id)?.name).toBe(project.name);

    projects.update(USER_A, {
      ...project,
      name: 'Trip',
      description: '',
      budgetCents: 1,
      updatedAt,
    });

    expect(projects.findById(USER_A, project.id)).toEqual({
      ...project,
      name: 'Trip',
      description: '',
      updatedAt,
    });
  });

  it('deletes a project only when the owning user matches', () => {
    const project = makeProject();
    projects.insert(USER_A, project);

    projects.delete(USER_B, project.id);
    expect(projects.findById(USER_A, project.id)).toBeDefined();

    projects.delete(USER_A, project.id);
    expect(projects.findById(USER_A, project.id)).toBeUndefined();
  });
});

describe('transaction repository', () => {
  const project = makeProject();

  beforeEach(() => projects.insert(USER_A, project));

  it('inserts a transaction and reads it back only for its owner', () => {
    const transaction = makeTransaction({ projectId: project.id });
    transactions.insert(USER_A, transaction);

    const found = transactions.findById(USER_A, transaction.id);
    expect(found).toEqual(transaction);
    expect(TransactionSchema.parse(found)).toEqual(transaction);
    expect(transactions.findById(USER_B, transaction.id)).toBeUndefined();
    expect(transactions.findById(USER_A, uuid(999))).toBeUndefined();
  });

  it('updates the changeable fields for the owner but never the account', () => {
    const transaction = makeTransaction();
    transactions.insert(USER_A, transaction);
    const changed = {
      ...transaction,
      account: 'savings' as const,
      type: 'income' as const,
      amountCents: 1,
      date: '2026-01-01',
      description: 'Refund',
      projectId: project.id,
      updatedAt: new Date('2026-11-02T00:00:00.000Z'),
    };

    transactions.update(USER_B, changed);
    expect(transactions.findById(USER_A, transaction.id)?.description).toBe(
      transaction.description,
    );

    transactions.update(USER_A, changed);
    expect(transactions.findById(USER_A, transaction.id)).toEqual({ ...changed, account: 'main' });
  });

  it('deletes a transaction and counts per project scoped to the owner', () => {
    transactions.insert(USER_A, makeTransaction({ id: uuid(1), projectId: project.id }));
    transactions.insert(USER_A, makeTransaction({ id: uuid(2) }));

    expect(transactions.countByProject(USER_A, project.id)).toBe(1);
    expect(transactions.countByProject(USER_B, project.id)).toBe(0);
    expect(transactions.count(USER_A)).toBe(2);

    transactions.delete(USER_B, uuid(1));
    expect(transactions.count(USER_A)).toBe(2);

    transactions.delete(USER_A, uuid(1));

    expect(transactions.countByProject(USER_A, project.id)).toBe(0);
    expect(transactions.count(USER_A)).toBe(1);
  });

  describe('list', () => {
    beforeEach(() => {
      const at = (s: string) => new Date(`2026-11-01T08:00:${s}.000Z`);
      transactions.insert(
        USER_A,
        makeTransaction({ id: uuid(1), date: '2026-09-01', createdAt: at('01') }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({
          id: uuid(2),
          date: '2026-10-01',
          account: 'savings',
          type: 'income',
          createdAt: at('02'),
        }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({
          id: uuid(3),
          date: '2026-10-01',
          projectId: project.id,
          createdAt: at('03'),
        }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({ id: uuid(4), date: '2026-11-01', createdAt: at('04') }),
      );
      transactions.insert(
        USER_B,
        makeTransaction({ id: uuid(50), date: '2026-11-01', createdAt: at('05') }),
      );
    });

    const ids = (page: { items: { id: string }[] }) => page.items.map((t) => t.id);
    const all = { limit: 50, offset: 0 };

    it('lists newest first by date, then by creation, for that user only', () => {
      const page = transactions.list(USER_A, all);

      expect(ids(page)).toEqual([uuid(4), uuid(3), uuid(2), uuid(1)]);
      expect(page.total).toBe(4);
    });

    it('filters by account, project and type', () => {
      expect(ids(transactions.list(USER_A, { ...all, account: 'savings' }))).toEqual([uuid(2)]);
      expect(ids(transactions.list(USER_A, { ...all, projectId: project.id }))).toEqual([uuid(3)]);
      expect(ids(transactions.list(USER_A, { ...all, type: 'income' }))).toEqual([uuid(2)]);
    });

    it('filters by an inclusive date range', () => {
      const page = transactions.list(USER_A, { ...all, from: '2026-10-01', to: '2026-10-01' });

      expect(ids(page)).toEqual([uuid(3), uuid(2)]);
    });

    it('pages with limit and offset and reports the total of the filter', () => {
      const page = transactions.list(USER_A, { limit: 2, offset: 1, account: 'main' });

      expect(ids(page)).toEqual([uuid(3), uuid(1)]);
      expect(page.total).toBe(3);
    });
  });

  describe('sums', () => {
    beforeEach(() => {
      const other = makeProject({ id: uuid(101), name: 'Bike' });
      projects.insert(USER_A, other);
      transactions.insert(
        USER_A,
        makeTransaction({ id: uuid(1), type: 'income', amountCents: 500_000, date: '2026-08-25' }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({
          id: uuid(2),
          amountCents: 30_000,
          date: '2026-09-02',
          projectId: project.id,
        }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({
          id: uuid(3),
          amountCents: 20_000,
          date: '2026-09-05',
          projectId: project.id,
        }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({
          id: uuid(4),
          account: 'savings',
          type: 'income',
          amountCents: 10_000,
          date: '2026-09-10',
          projectId: project.id,
        }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({
          id: uuid(5),
          amountCents: 70_000,
          date: '2026-10-01',
          projectId: other.id,
        }),
      );
      transactions.insert(
        USER_A,
        makeTransaction({ id: uuid(6), amountCents: 1_000, date: '2026-10-02' }),
      );
      transactions.insert(
        USER_B,
        makeTransaction({ id: uuid(70), amountCents: 999_999, date: '2026-09-15' }),
      );
    });

    it('sums per account and type for that user only', () => {
      expect(transactions.totalsByAccount(USER_A)).toEqual([
        { account: 'main', type: 'expense', totalCents: 121_000 },
        { account: 'main', type: 'income', totalCents: 500_000 },
        { account: 'savings', type: 'income', totalCents: 10_000 },
      ]);
    });

    it('sums per project tag and type, ignoring untagged transactions', () => {
      expect(transactions.totalsByProject(USER_A)).toEqual([
        { projectId: uuid(100), type: 'expense', totalCents: 50_000 },
        { projectId: uuid(100), type: 'income', totalCents: 10_000 },
        { projectId: uuid(101), type: 'expense', totalCents: 70_000 },
      ]);
    });

    it('sums per month, account and type up to a date', () => {
      expect(transactions.monthlyTotals(USER_A, '2026-09-30')).toEqual([
        { month: '2026-08', account: 'main', type: 'income', totalCents: 500_000 },
        { month: '2026-09', account: 'main', type: 'expense', totalCents: 50_000 },
        { month: '2026-09', account: 'savings', type: 'income', totalCents: 10_000 },
      ]);
    });

    it('sums expenses per project in a date range, largest first, untagged as null', () => {
      expect(transactions.expenseByProject(USER_A, '2026-09-01', '2026-10-31')).toEqual([
        { projectId: uuid(101), name: 'Bike', expenseCents: 70_000 },
        { projectId: uuid(100), name: 'Holiday', expenseCents: 50_000 },
        { projectId: null, name: null, expenseCents: 1_000 },
      ]);
      expect(transactions.expenseByProject(USER_A, '2026-09-03', '2026-09-30')).toEqual([
        { projectId: uuid(100), name: 'Holiday', expenseCents: 20_000 },
      ]);
    });
  });
});

describe('event repository', () => {
  const occurredAt = new Date('2026-11-03T10:00:00.000Z');
  const created = (n: number, userId = USER_A) => ({
    id: uuid(n),
    userId,
    type: 'CreateProjectEvent' as const,
    occurredAt,
    payload: { project: makeProject() },
  });

  it('appends an event and returns it with an increasing sequence', () => {
    const first = events.append(created(1));
    const second = events.append(created(2));

    expect(first).toEqual({ ...created(1), sequence: 1 });
    expect(second.sequence).toBe(2);
    expect(BusinessEventSchema.parse(first)).toEqual(first);
  });

  it('throws on an event that does not satisfy the schema', () => {
    const invalid = { ...created(1), payload: { project: { name: 'only a name' } } };

    // @ts-expect-error the payload is deliberately incomplete
    expect(() => events.append(invalid)).toThrow();
  });

  it('lists newest first, filtered by user and type, with paging', () => {
    events.append(created(1, USER_A));
    events.append({
      id: uuid(2),
      userId: USER_A,
      type: 'DeleteProjectEvent',
      occurredAt,
      payload: { project: makeProject() },
    });
    events.append(created(3, USER_A));
    events.append(created(4, USER_B));

    const all = events.list(USER_A, { limit: 10, offset: 0 });
    expect(all.items.map((e) => e.sequence)).toEqual([3, 2, 1]);
    expect(all.total).toBe(3);

    const creates = events.list(USER_A, { type: 'CreateProjectEvent', limit: 1, offset: 1 });
    expect(creates.items.map((e) => e.id)).toEqual([uuid(1)]);
    expect(creates.total).toBe(2);
  });
});
