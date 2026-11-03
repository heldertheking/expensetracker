import { BUSINESS_EVENT_TYPES, NOTHING_CHANGED } from '@expensetracker/schema';
import type { ProjectRecord, Transaction } from '@expensetracker/schema';
import { describe, expect, it, vi } from 'vitest';
import { createHandlers } from '../../src/events/handlers/index.js';
import type { HandlerDeps } from '../../src/events/handlers/index.js';
import { makeProject, makeTransaction, uuid } from '../fixtures.js';

const NOW = new Date('2026-11-03T10:00:00.000Z');
const USER_ID = uuid(900);

/** Handler dependencies with every repository method mocked. */
function mockDeps(
  data: { projects?: ProjectRecord[]; transactions?: Transaction[]; tagged?: number } = {},
) {
  const projects = data.projects ?? [];
  const transactions = data.transactions ?? [];
  const deps = {
    projects: {
      findById: vi.fn((_userId: string, id: string) => projects.find((p) => p.id === id)),
      findByName: vi.fn((_userId: string, name: string) =>
        projects.find((p) => p.name.toLowerCase() === name.toLowerCase()),
      ),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transactions: {
      findById: vi.fn((_userId: string, id: string) => transactions.find((t) => t.id === id)),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByProject: vi.fn(() => data.tagged ?? 0),
      totalsByProject: vi.fn(() => []),
    },
    clock: vi.fn(() => NOW),
    newId: vi.fn(() => uuid(42)),
  } satisfies HandlerDeps;
  return { deps, handlers: createHandlers(deps) };
}

/** Runs a handler like the bus does: validate, then handle with what validate returned. */
function run<T extends keyof ReturnType<typeof createHandlers>>(
  handlers: ReturnType<typeof createHandlers>,
  type: T,
  data: Parameters<ReturnType<typeof createHandlers>[T]['validate']>[1],
) {
  const handler = handlers[type];
  // @ts-expect-error the data type is tied to T through the caller
  return handler.handle(USER_ID, data, handler.validate(USER_ID, data));
}

const project = makeProject({ id: uuid(1), name: 'Holiday' });

it('registers a handler for every business event type', () => {
  expect(Object.keys(mockDeps().handlers).sort()).toEqual([...BUSINESS_EVENT_TYPES].sort());
});

describe('CreateTransactionEvent', () => {
  const request = {
    account: 'savings' as const,
    type: 'income' as const,
    amountCents: 100,
    date: '2026-10-01',
    description: 'Deposit',
    projectId: null,
  };

  it('inserts a new transaction with id and timestamps and records it', () => {
    const { deps, handlers } = mockDeps();

    const outcome = run(handlers, 'CreateTransactionEvent', request);

    const expected = { ...request, id: uuid(42), createdAt: NOW, updatedAt: NOW };
    expect(deps.transactions.insert).toHaveBeenCalledWith(USER_ID, expected);
    expect(outcome).toEqual({ result: expected, payload: { transaction: expected } });
  });

  it('accepts a tag of an existing project', () => {
    const { deps, handlers } = mockDeps({ projects: [project] });

    run(handlers, 'CreateTransactionEvent', { ...request, projectId: project.id });

    expect(deps.transactions.insert).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ projectId: project.id }),
    );
  });

  it('rejects a tag of an unknown project as unprocessable before inserting', () => {
    const { deps, handlers } = mockDeps();

    expect(() =>
      run(handlers, 'CreateTransactionEvent', { ...request, projectId: uuid(9) }),
    ).toThrow(
      expect.objectContaining({
        code: 'unprocessable',
        issues: [{ path: 'projectId', message: 'the tagged project does not exist' }],
      }),
    );
    expect(deps.transactions.insert).not.toHaveBeenCalled();
  });
});

describe('UpdateTransactionEvent', () => {
  const existing = makeTransaction({ id: uuid(5), projectId: null });

  it('applies only the sent fields, keeps account and createdAt, and records before and after', () => {
    const { deps, handlers } = mockDeps({ transactions: [existing], projects: [project] });

    const outcome = run(handlers, 'UpdateTransactionEvent', {
      id: existing.id,
      patch: { description: 'Weekly shop', projectId: project.id },
    });

    const after = {
      ...existing,
      description: 'Weekly shop',
      projectId: project.id,
      updatedAt: NOW,
    };
    expect(deps.transactions.update).toHaveBeenCalledWith(USER_ID, after);
    expect(outcome).toEqual({ result: after, payload: { before: existing, after } });
  });

  it('detaches the project when projectId is null', () => {
    const tagged = { ...existing, projectId: project.id };
    const { handlers } = mockDeps({ transactions: [tagged], projects: [project] });

    const { result } = run(handlers, 'UpdateTransactionEvent', {
      id: tagged.id,
      patch: { projectId: null },
    });

    expect(result.projectId).toBeNull();
  });

  it('changes type and amount together', () => {
    const { handlers } = mockDeps({ transactions: [existing] });

    const { result } = run(handlers, 'UpdateTransactionEvent', {
      id: existing.id,
      patch: { type: 'income', amountCents: 1, date: '2026-01-02' },
    });

    expect(result).toMatchObject({ type: 'income', amountCents: 1, date: '2026-01-02' });
  });

  it('throws not_found for an unknown transaction', () => {
    const { handlers } = mockDeps();

    expect(() =>
      run(handlers, 'UpdateTransactionEvent', { id: uuid(9), patch: { description: 'x' } }),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
  });

  it('rejects an update that changes nothing as a validation error', () => {
    const { deps, handlers } = mockDeps({ transactions: [existing] });

    expect(() =>
      run(handlers, 'UpdateTransactionEvent', {
        id: existing.id,
        patch: { description: existing.description },
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'validation_error',
        issues: [{ path: '', message: NOTHING_CHANGED }],
      }),
    );
    expect(deps.transactions.update).not.toHaveBeenCalled();
  });

  it('rejects a type change without the amount', () => {
    const { handlers } = mockDeps({ transactions: [existing] });

    expect(() =>
      run(handlers, 'UpdateTransactionEvent', { id: existing.id, patch: { type: 'income' } }),
    ).toThrow(expect.objectContaining({ code: 'validation_error' }));
  });

  it('rejects a new tag of an unknown project as unprocessable', () => {
    const { handlers } = mockDeps({ transactions: [existing] });

    expect(() =>
      run(handlers, 'UpdateTransactionEvent', { id: existing.id, patch: { projectId: uuid(9) } }),
    ).toThrow(expect.objectContaining({ code: 'unprocessable' }));
  });
});

describe('DeleteTransactionEvent', () => {
  const existing = makeTransaction({ id: uuid(5) });

  it('deletes the transaction and records the deleted snapshot', () => {
    const { deps, handlers } = mockDeps({ transactions: [existing] });

    const outcome = run(handlers, 'DeleteTransactionEvent', { id: existing.id });

    expect(deps.transactions.delete).toHaveBeenCalledWith(USER_ID, existing.id);
    expect(outcome).toEqual({ result: existing, payload: { transaction: existing } });
  });

  it('throws not_found for an unknown transaction', () => {
    const { deps, handlers } = mockDeps();

    expect(() => run(handlers, 'DeleteTransactionEvent', { id: uuid(9) })).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    );
    expect(deps.transactions.delete).not.toHaveBeenCalled();
  });
});

describe('CreateProjectEvent', () => {
  const request = { name: 'Bike', description: 'New bike', budgetCents: 50_000 };

  it('inserts a new project and records it', () => {
    const { deps, handlers } = mockDeps({ projects: [project] });

    const outcome = run(handlers, 'CreateProjectEvent', request);

    const expected = { ...request, id: uuid(42), createdAt: NOW, updatedAt: NOW };
    expect(deps.projects.insert).toHaveBeenCalledWith(USER_ID, expected);
    expect(outcome).toEqual({ result: expected, payload: { project: expected } });
  });

  it('rejects a name that exists in any case as a conflict', () => {
    const { deps, handlers } = mockDeps({ projects: [project] });

    expect(() => run(handlers, 'CreateProjectEvent', { ...request, name: 'HOLIDAY' })).toThrow(
      expect.objectContaining({
        code: 'conflict',
        message: 'a project named "Holiday" already exists',
      }),
    );
    expect(deps.projects.insert).not.toHaveBeenCalled();
  });
});

describe('UpdateProjectEvent', () => {
  it('renames the project, keeps the budget and records before and after', () => {
    const { deps, handlers } = mockDeps({ projects: [project] });

    const outcome = run(handlers, 'UpdateProjectEvent', {
      id: project.id,
      patch: { name: 'Summer holiday' },
    });

    const after = { ...project, name: 'Summer holiday', updatedAt: NOW };
    expect(deps.projects.update).toHaveBeenCalledWith(USER_ID, after);
    expect(outcome).toEqual({ result: after, payload: { before: project, after } });
  });

  it('allows a project to change the case of its own name', () => {
    const { handlers } = mockDeps({ projects: [project] });

    const { result } = run(handlers, 'UpdateProjectEvent', {
      id: project.id,
      patch: { name: 'HOLIDAY', description: 'x' },
    });

    expect(result).toMatchObject({ name: 'HOLIDAY', description: 'x' });
  });

  it('rejects the name of another project as a conflict', () => {
    const other = makeProject({ id: uuid(2), name: 'Bike' });
    const { handlers } = mockDeps({ projects: [project, other] });

    expect(() =>
      run(handlers, 'UpdateProjectEvent', { id: project.id, patch: { name: 'bike' } }),
    ).toThrow(expect.objectContaining({ code: 'conflict' }));
  });

  it('rejects an update that changes nothing', () => {
    const { handlers } = mockDeps({ projects: [project] });

    expect(() =>
      run(handlers, 'UpdateProjectEvent', { id: project.id, patch: { name: project.name } }),
    ).toThrow(expect.objectContaining({ code: 'validation_error' }));
  });

  it('throws not_found for an unknown project', () => {
    const { handlers } = mockDeps();

    expect(() =>
      run(handlers, 'UpdateProjectEvent', { id: uuid(9), patch: { name: 'x' } }),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
  });
});

describe('DeleteProjectEvent', () => {
  it('deletes an untagged project and records the deleted snapshot', () => {
    const { deps, handlers } = mockDeps({ projects: [project] });

    const outcome = run(handlers, 'DeleteProjectEvent', { id: project.id });

    expect(deps.transactions.countByProject).toHaveBeenCalledWith(USER_ID, project.id);
    expect(deps.projects.delete).toHaveBeenCalledWith(USER_ID, project.id);
    expect(outcome).toEqual({ result: project, payload: { project } });
  });

  it('refuses to delete a project that still tags transactions', () => {
    const { deps, handlers } = mockDeps({ projects: [project], tagged: 2 });

    expect(() => run(handlers, 'DeleteProjectEvent', { id: project.id })).toThrow(
      expect.objectContaining({
        code: 'conflict',
        message: expect.stringContaining('2 transaction'),
      }),
    );
    expect(deps.projects.delete).not.toHaveBeenCalled();
  });

  it('throws not_found for an unknown project', () => {
    const { handlers } = mockDeps();

    expect(() => run(handlers, 'DeleteProjectEvent', { id: uuid(9) })).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    );
  });
});
