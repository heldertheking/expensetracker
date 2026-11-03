import type { Database } from 'better-sqlite3';
import {
  BusinessEventSchema,
  ProjectRecordSchema,
  TransactionSchema,
} from '@expensetracker/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/database.js';
import { createEventRepository } from '../../src/repositories/event-repository.js';
import type { EventRepository } from '../../src/repositories/event-repository.js';
import { createProjectRepository } from '../../src/repositories/project-repository.js';
import type { ProjectRepository } from '../../src/repositories/project-repository.js';
import { createTransactionRepository } from '../../src/repositories/transaction-repository.js';
import type { TransactionRepository } from '../../src/repositories/transaction-repository.js';
import { makeProject, makeTransaction, uuid } from '../fixtures.js';

let db: Database;
let projects: ProjectRepository;
let transactions: TransactionRepository;
let events: EventRepository;

beforeEach(() => {
  db = openDatabase();
  projects = createProjectRepository(db);
  transactions = createTransactionRepository(db);
  events = createEventRepository(db);
});

afterEach(() => db.close());

describe('project repository', () => {
  it('inserts a project and reads it back as a schema-valid record', () => {
    const project = makeProject({ budgetCents: null });
    projects.insert(project);

    const found = projects.findById(project.id);
    expect(found).toEqual(project);
    expect(ProjectRecordSchema.parse(found)).toEqual(project);
  });

  it('returns undefined for an unknown id or name', () => {
    expect(projects.findById(uuid(999))).toBeUndefined();
    expect(projects.findByName('nothing')).toBeUndefined();
  });

  it('finds a project by name ignoring case', () => {
    projects.insert(makeProject({ name: 'Holiday' }));

    expect(projects.findByName('HOLIDAY')?.name).toBe('Holiday');
  });

  it('rejects a second project with the same name in another case', () => {
    projects.insert(makeProject({ id: uuid(1), name: 'Holiday' }));

    expect(() => projects.insert(makeProject({ id: uuid(2), name: 'holiday' }))).toThrow(/UNIQUE/);
  });

  it('lists projects by name', () => {
    projects.insert(makeProject({ id: uuid(1), name: 'zoo' }));
    projects.insert(makeProject({ id: uuid(2), name: 'Bike' }));

    expect(projects.list().map((p) => p.name)).toEqual(['Bike', 'zoo']);
    expect(projects.count()).toBe(2);
  });

  it('updates name, description and updatedAt but never the budget', () => {
    const project = makeProject();
    projects.insert(project);
    const updatedAt = new Date('2026-11-02T00:00:00.000Z');

    projects.update({ ...project, name: 'Trip', description: '', budgetCents: 1, updatedAt });

    expect(projects.findById(project.id)).toEqual({
      ...project,
      name: 'Trip',
      description: '',
      updatedAt,
    });
  });

  it('deletes a project', () => {
    const project = makeProject();
    projects.insert(project);

    projects.delete(project.id);

    expect(projects.findById(project.id)).toBeUndefined();
  });
});

describe('transaction repository', () => {
  const project = makeProject();

  beforeEach(() => projects.insert(project));

  it('inserts a transaction and reads it back as a schema-valid record', () => {
    const transaction = makeTransaction({ projectId: project.id });
    transactions.insert(transaction);

    const found = transactions.findById(transaction.id);
    expect(found).toEqual(transaction);
    expect(TransactionSchema.parse(found)).toEqual(transaction);
    expect(transactions.findById(uuid(999))).toBeUndefined();
  });

  it('updates the changeable fields but never the account', () => {
    const transaction = makeTransaction();
    transactions.insert(transaction);
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

    transactions.update(changed);

    expect(transactions.findById(transaction.id)).toEqual({ ...changed, account: 'main' });
  });

  it('deletes a transaction and counts per project', () => {
    transactions.insert(makeTransaction({ id: uuid(1), projectId: project.id }));
    transactions.insert(makeTransaction({ id: uuid(2) }));

    expect(transactions.countByProject(project.id)).toBe(1);
    expect(transactions.count()).toBe(2);

    transactions.delete(uuid(1));

    expect(transactions.countByProject(project.id)).toBe(0);
    expect(transactions.count()).toBe(1);
  });

  describe('list', () => {
    beforeEach(() => {
      const at = (s: string) => new Date(`2026-11-01T08:00:${s}.000Z`);
      transactions.insert(
        makeTransaction({ id: uuid(1), date: '2026-09-01', createdAt: at('01') }),
      );
      transactions.insert(
        makeTransaction({
          id: uuid(2),
          date: '2026-10-01',
          account: 'savings',
          type: 'income',
          createdAt: at('02'),
        }),
      );
      transactions.insert(
        makeTransaction({
          id: uuid(3),
          date: '2026-10-01',
          projectId: project.id,
          createdAt: at('03'),
        }),
      );
      transactions.insert(
        makeTransaction({ id: uuid(4), date: '2026-11-01', createdAt: at('04') }),
      );
    });

    const ids = (page: { items: { id: string }[] }) => page.items.map((t) => t.id);
    const all = { limit: 50, offset: 0 };

    it('lists newest first by date, then by creation', () => {
      const page = transactions.list(all);

      expect(ids(page)).toEqual([uuid(4), uuid(3), uuid(2), uuid(1)]);
      expect(page.total).toBe(4);
    });

    it('filters by account, project and type', () => {
      expect(ids(transactions.list({ ...all, account: 'savings' }))).toEqual([uuid(2)]);
      expect(ids(transactions.list({ ...all, projectId: project.id }))).toEqual([uuid(3)]);
      expect(ids(transactions.list({ ...all, type: 'income' }))).toEqual([uuid(2)]);
    });

    it('filters by an inclusive date range', () => {
      const page = transactions.list({ ...all, from: '2026-10-01', to: '2026-10-01' });

      expect(ids(page)).toEqual([uuid(3), uuid(2)]);
    });

    it('pages with limit and offset and reports the total of the filter', () => {
      const page = transactions.list({ limit: 2, offset: 1, account: 'main' });

      expect(ids(page)).toEqual([uuid(3), uuid(1)]);
      expect(page.total).toBe(3);
    });
  });

  describe('sums', () => {
    beforeEach(() => {
      const other = makeProject({ id: uuid(101), name: 'Bike' });
      projects.insert(other);
      transactions.insert(
        makeTransaction({ id: uuid(1), type: 'income', amountCents: 500_000, date: '2026-08-25' }),
      );
      transactions.insert(
        makeTransaction({
          id: uuid(2),
          amountCents: 30_000,
          date: '2026-09-02',
          projectId: project.id,
        }),
      );
      transactions.insert(
        makeTransaction({
          id: uuid(3),
          amountCents: 20_000,
          date: '2026-09-05',
          projectId: project.id,
        }),
      );
      transactions.insert(
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
        makeTransaction({
          id: uuid(5),
          amountCents: 70_000,
          date: '2026-10-01',
          projectId: other.id,
        }),
      );
      transactions.insert(makeTransaction({ id: uuid(6), amountCents: 1_000, date: '2026-10-02' }));
    });

    it('sums per account and type', () => {
      expect(transactions.totalsByAccount()).toEqual([
        { account: 'main', type: 'expense', totalCents: 121_000 },
        { account: 'main', type: 'income', totalCents: 500_000 },
        { account: 'savings', type: 'income', totalCents: 10_000 },
      ]);
    });

    it('sums per project tag and type, ignoring untagged transactions', () => {
      expect(transactions.totalsByProject()).toEqual([
        { projectId: uuid(100), type: 'expense', totalCents: 50_000 },
        { projectId: uuid(100), type: 'income', totalCents: 10_000 },
        { projectId: uuid(101), type: 'expense', totalCents: 70_000 },
      ]);
    });

    it('sums per month, account and type up to a date', () => {
      expect(transactions.monthlyTotals('2026-09-30')).toEqual([
        { month: '2026-08', account: 'main', type: 'income', totalCents: 500_000 },
        { month: '2026-09', account: 'main', type: 'expense', totalCents: 50_000 },
        { month: '2026-09', account: 'savings', type: 'income', totalCents: 10_000 },
      ]);
    });

    it('sums expenses per project in a date range, largest first, untagged as null', () => {
      expect(transactions.expenseByProject('2026-09-01', '2026-10-31')).toEqual([
        { projectId: uuid(101), name: 'Bike', expenseCents: 70_000 },
        { projectId: uuid(100), name: 'Holiday', expenseCents: 50_000 },
        { projectId: null, name: null, expenseCents: 1_000 },
      ]);
      expect(transactions.expenseByProject('2026-09-03', '2026-09-30')).toEqual([
        { projectId: uuid(100), name: 'Holiday', expenseCents: 20_000 },
      ]);
    });
  });
});

describe('event repository', () => {
  const occurredAt = new Date('2026-11-03T10:00:00.000Z');
  const created = (n: number) => ({
    id: uuid(n),
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

  it('lists newest first, filtered by type, with paging', () => {
    events.append(created(1));
    events.append({
      id: uuid(2),
      type: 'DeleteProjectEvent',
      occurredAt,
      payload: { project: makeProject() },
    });
    events.append(created(3));

    const all = events.list({ limit: 10, offset: 0 });
    expect(all.items.map((e) => e.sequence)).toEqual([3, 2, 1]);
    expect(all.total).toBe(3);

    const creates = events.list({ type: 'CreateProjectEvent', limit: 1, offset: 1 });
    expect(creates.items.map((e) => e.id)).toEqual([uuid(1)]);
    expect(creates.total).toBe(2);
  });
});
