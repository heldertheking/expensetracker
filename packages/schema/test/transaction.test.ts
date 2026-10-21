import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreateTransactionRequest,
  ListTransactionsQuery,
  TransactionListResponse,
  TransactionSchema,
  UpdateTransactionRequest,
  validateTransactionUpdate,
} from '../src/index.js';
import type { Transaction } from '../src/index.js';

const ID = '3f2b8c1e-5a47-4d1b-9c63-0e8d2f6a7b10';
const PROJECT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const now = new Date('2026-06-15T12:00:00Z');

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: ID,
  account: 'main',
  type: 'expense',
  amountCents: 1_250,
  date: '2026-06-10',
  description: 'Groceries',
  projectId: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const valid = { type: 'expense', amountCents: 1_250, date: '2026-06-10', description: 'Groceries' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe('CreateTransactionRequest', () => {
  it('defaults to the main account and no project', () => {
    const parsed = CreateTransactionRequest.parse(valid);
    expect(parsed.account).toBe('main');
    expect(parsed.projectId).toBeNull();
  });

  it('accepts a savings deposit attached to a project', () => {
    const parsed = CreateTransactionRequest.parse({
      ...valid,
      account: 'savings',
      type: 'income',
      projectId: PROJECT_ID,
    });
    expect(parsed).toMatchObject({ account: 'savings', type: 'income', projectId: PROJECT_ID });
  });

  it('accepts today and, for time zones ahead of UTC, tomorrow', () => {
    expect(CreateTransactionRequest.safeParse({ ...valid, date: '2026-06-15' }).success).toBe(true);
    expect(CreateTransactionRequest.safeParse({ ...valid, date: '2026-06-16' }).success).toBe(true);
  });

  it.each([
    ['a date in the future', { date: '2026-06-17' }],
    ['a date before 2000', { date: '1999-12-31' }],
    ['a date with a time', { date: '2026-06-10T10:00:00Z' }],
    ['an impossible date', { date: '2026-02-30' }],
    ['zero amount', { amountCents: 0 }],
    ['negative amount', { amountCents: -100 }],
    ['fractional amount', { amountCents: 12.5 }],
    ['amount above the maximum', { amountCents: 100_000_000_001 }],
    ['blank description', { description: '  ' }],
    ['description too long', { description: 'x'.repeat(201) }],
    ['unknown type', { type: 'transfer' }],
    ['unknown account', { account: 'checking' }],
    ['project id that is not a uuid', { projectId: '42' }],
    ['unknown field', { category: 'food' }],
  ])('rejects %s', (_label, override) => {
    expect(CreateTransactionRequest.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each(['id', 'createdAt', 'updatedAt'])(
    'explains that %s is managed by the server',
    (field) => {
      const result = CreateTransactionRequest.safeParse({ ...valid, [field]: 'x' });
      expect(result.error?.issues.map((issue) => issue.message)).toContain(
        `${field} is managed by the server and cannot be set`,
      );
    },
  );
});

describe('UpdateTransactionRequest', () => {
  it('accepts a partial update', () => {
    expect(UpdateTransactionRequest.parse({ description: 'Lunch' })).toEqual({
      description: 'Lunch',
    });
  });

  it('allows detaching from a project with null', () => {
    expect(UpdateTransactionRequest.parse({ projectId: null })).toEqual({ projectId: null });
  });

  it('rejects changing the account with an explanation', () => {
    const result = UpdateTransactionRequest.safeParse({ description: 'x', account: 'savings' });
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'account cannot be changed; delete the transaction and create a new one',
    );
  });

  it('rejects an empty update', () => {
    expect(UpdateTransactionRequest.safeParse({}).success).toBe(false);
  });

  it('applies the same date rules as creation', () => {
    expect(UpdateTransactionRequest.safeParse({ date: '2026-06-17' }).success).toBe(false);
  });
});

describe('validateTransactionUpdate', () => {
  it('rejects an update that changes nothing', () => {
    const issues = validateTransactionUpdate(transaction(), {
      description: 'Groceries',
      amountCents: 1_250,
    });
    expect(issues).toEqual([{ path: '', message: expect.stringMatching(/nothing changed/) }]);
  });

  it('rejects a type change without resending the amount', () => {
    const issues = validateTransactionUpdate(transaction(), { type: 'income' });
    expect(issues).toEqual([
      { path: 'amountCents', message: expect.stringMatching(/sent again when type changes/) },
    ]);
  });

  it('accepts a type change that resends the amount', () => {
    expect(
      validateTransactionUpdate(transaction(), { type: 'income', amountCents: 1_250 }),
    ).toEqual([]);
  });

  it('accepts sending the unchanged type without the amount', () => {
    expect(validateTransactionUpdate(transaction(), { type: 'expense', description: 'x' })).toEqual(
      [],
    );
  });

  it('treats detaching from a project as a change', () => {
    const existing = transaction({ projectId: PROJECT_ID });
    expect(validateTransactionUpdate(existing, { projectId: null })).toEqual([]);
  });
});

describe('ListTransactionsQuery', () => {
  it('defaults to the main view with a page of 50', () => {
    expect(ListTransactionsQuery.parse({})).toEqual({ view: 'main', limit: 50, offset: 0 });
  });

  it('coerces numeric query strings', () => {
    const parsed = ListTransactionsQuery.parse({ view: 'savings', limit: '10', offset: '20' });
    expect(parsed).toMatchObject({ view: 'savings', limit: 10, offset: 20 });
  });

  it.each([
    ['limit above 100', { limit: '101' }],
    ['limit below 1', { limit: '0' }],
    ['negative offset', { offset: '-1' }],
    ['non-numeric limit', { limit: 'many' }],
    ['unknown view', { view: 'all' }],
    ['from after to', { from: '2026-06-10', to: '2026-06-01' }],
    ['unknown parameter', { sort: 'date' }],
  ])('rejects %s', (_label, query) => {
    expect(ListTransactionsQuery.safeParse(query).success).toBe(false);
  });

  it('accepts from equal to to', () => {
    expect(ListTransactionsQuery.safeParse({ from: '2026-06-10', to: '2026-06-10' }).success).toBe(
      true,
    );
  });
});

describe('TransactionSchema and TransactionListResponse', () => {
  it('accepts a stored transaction, including a date that is now in the future', () => {
    expect(TransactionSchema.safeParse(transaction({ date: '2030-01-01' })).success).toBe(true);
  });

  it('rejects an unknown account in a response', () => {
    expect(TransactionSchema.safeParse({ ...transaction(), account: 'x' }).success).toBe(false);
  });

  it('accepts a consistent page', () => {
    const page = { items: [transaction()], total: 31, limit: 10, offset: 30 };
    expect(TransactionListResponse.safeParse(page).success).toBe(true);
  });

  it('rejects more items than the limit', () => {
    const page = { items: [transaction(), transaction()], total: 2, limit: 1, offset: 0 };
    expect(TransactionListResponse.safeParse(page).success).toBe(false);
  });

  it('rejects a page that runs past the total', () => {
    const page = { items: [transaction()], total: 5, limit: 10, offset: 5 };
    expect(TransactionListResponse.safeParse(page).success).toBe(false);
  });
});
