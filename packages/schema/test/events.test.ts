import { describe, expect, it } from 'vitest';
import {
  BUSINESS_EVENT_TYPES,
  BusinessEventSchema,
  EventListResponse,
  ListEventsQuery,
} from '../src/index.js';

const now = '2026-06-15T12:00:00.000Z';

const transaction = {
  id: '3f2b8c1e-5a47-4d1b-9c63-0e8d2f6a7b10',
  account: 'savings',
  type: 'income',
  amountCents: 10_000,
  date: '2026-06-10',
  description: 'Deposit',
  projectId: null,
  createdAt: now,
  updatedAt: now,
};

const project = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  name: 'Holiday',
  description: '',
  budgetCents: 100_000,
  createdAt: now,
  updatedAt: now,
};

const userId = '9b2f4c1a-8d3e-4f5a-b6c7-d8e9f0a1b2c3';

const event = (sequence: number, type: string, payload: object) => ({
  id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
  sequence,
  userId,
  occurredAt: now,
  type,
  payload,
});

describe('BusinessEventSchema', () => {
  it('names every event after a business action', () => {
    expect(
      BUSINESS_EVENT_TYPES.every((type) => /^(Create|Update|Delete)\w+Event$/.test(type)),
    ).toBe(true);
  });

  it.each([
    ['CreateTransactionEvent', { transaction }],
    ['UpdateTransactionEvent', { before: transaction, after: { ...transaction, amountCents: 1 } }],
    ['DeleteTransactionEvent', { transaction }],
    ['CreateProjectEvent', { project }],
    ['UpdateProjectEvent', { before: project, after: { ...project, name: 'Trip' } }],
    ['DeleteProjectEvent', { project }],
  ])('accepts a %s with its payload', (type, payload) => {
    const parsed = BusinessEventSchema.parse(event(1, type, payload));
    expect(parsed.type).toBe(type);
    expect(parsed.occurredAt).toBeInstanceOf(Date);
  });

  it('requires the user the event belongs to', () => {
    const { userId: _omit, ...withoutUser } = event(1, 'CreateProjectEvent', { project });
    void _omit;
    expect(BusinessEventSchema.safeParse(withoutUser).success).toBe(false);
    expect(BusinessEventSchema.safeParse({ ...withoutUser, userId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects a payload that belongs to another event type', () => {
    expect(
      BusinessEventSchema.safeParse(event(1, 'CreateTransactionEvent', { project })).success,
    ).toBe(false);
  });

  it('rejects an unknown event type', () => {
    expect(BusinessEventSchema.safeParse(event(1, 'TransferEvent', { transaction })).success).toBe(
      false,
    );
  });

  it.each([
    ['id', { id: '00000000-0000-4000-8000-000000000099' }],
    ['account', { account: 'main' }],
    ['createdAt', { createdAt: '2026-06-16T00:00:00.000Z' }],
  ])('rejects an UpdateTransactionEvent that changes %s', (_field, change) => {
    const payload = { before: transaction, after: { ...transaction, ...change } };
    expect(BusinessEventSchema.safeParse(event(1, 'UpdateTransactionEvent', payload)).success).toBe(
      false,
    );
  });

  it.each([
    ['id', { id: '00000000-0000-4000-8000-000000000099' }],
    ['budgetCents', { budgetCents: 1 }],
    ['createdAt', { createdAt: '2026-06-16T00:00:00.000Z' }],
  ])('rejects an UpdateProjectEvent that changes %s', (_field, change) => {
    const payload = { before: project, after: { ...project, ...change } };
    expect(BusinessEventSchema.safeParse(event(1, 'UpdateProjectEvent', payload)).success).toBe(
      false,
    );
  });

  it('accepts an update that changes updatedAt', () => {
    const after = { ...project, name: 'Trip', updatedAt: '2026-06-16T00:00:00.000Z' };
    const payload = { before: project, after };
    expect(BusinessEventSchema.safeParse(event(1, 'UpdateProjectEvent', payload)).success).toBe(
      true,
    );
  });

  it('rejects a sequence below 1', () => {
    expect(
      BusinessEventSchema.safeParse(event(0, 'CreateTransactionEvent', { transaction })).success,
    ).toBe(false);
  });
});

describe('ListEventsQuery', () => {
  it('defaults to a page of 20', () => {
    expect(ListEventsQuery.parse({})).toEqual({ limit: 20, offset: 0 });
  });

  it('filters by a known event type only', () => {
    expect(ListEventsQuery.safeParse({ type: 'CreateProjectEvent' }).success).toBe(true);
    expect(ListEventsQuery.safeParse({ type: 'Create' }).success).toBe(false);
  });
});

describe('EventListResponse', () => {
  const created = event(2, 'CreateTransactionEvent', { transaction });
  const projectCreated = event(1, 'CreateProjectEvent', { project });

  it('accepts a page ordered newest first', () => {
    const page = { items: [created, projectCreated], total: 2, limit: 20, offset: 0 };
    expect(EventListResponse.safeParse(page).success).toBe(true);
  });

  it('rejects a page ordered oldest first', () => {
    const page = { items: [projectCreated, created], total: 2, limit: 20, offset: 0 };
    expect(EventListResponse.safeParse(page).success).toBe(false);
  });

  it('rejects a page that runs past the total', () => {
    const page = { items: [created], total: 1, limit: 20, offset: 1 };
    expect(EventListResponse.safeParse(page).success).toBe(false);
  });

  it('accepts an empty page past the end', () => {
    const page = { items: [], total: 3, limit: 20, offset: 40 };
    expect(EventListResponse.safeParse(page).success).toBe(true);
  });

  it('rejects a short page when more items exist', () => {
    const page = { items: [created], total: 5, limit: 2, offset: 0 };
    expect(EventListResponse.safeParse(page).success).toBe(false);
  });
});
