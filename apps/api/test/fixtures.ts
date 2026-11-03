import type { ProjectRecord, Transaction } from '@expensetracker/schema';

/** Deterministic, valid v4 UUIDs: `uuid(1)` is `00000000-0000-4000-8000-000000000001`. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Returns `uuid(1)`, `uuid(2)`, ... on each call. */
function sequentialIds(start = 1) {
  let next = start;
  return () => uuid(next++);
}

/** A clock that starts at `start` and moves one second forward on each call. */
function steppingClock(start = '2026-11-03T10:00:00.000Z') {
  let ms = Date.parse(start);
  return () => {
    const now = new Date(ms);
    ms += 1000;
    return now;
  };
}

const T0 = new Date('2026-11-01T08:00:00.000Z');

function makeProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: uuid(100),
    name: 'Holiday',
    description: 'Summer trip',
    budgetCents: 200_000,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: uuid(200),
    account: 'main',
    type: 'expense',
    amountCents: 5_000,
    date: '2026-10-15',
    description: 'Groceries',
    projectId: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

export { makeProject, makeTransaction, sequentialIds, steppingClock, T0, uuid };
