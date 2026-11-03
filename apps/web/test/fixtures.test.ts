import { describe, expect, it } from 'vitest';
import {
  AccountsResponse,
  ApiErrorSchema,
  EventListResponse,
  ProjectListResponse,
  ProjectResponse,
  StatsResponse,
  TransactionListResponse,
  TransactionResponse,
} from '@expensetracker/schema';
import * as f from './fixtures';

/** The mocks are only useful if they satisfy the same contract the real API does. */
describe('fixtures satisfy the shared schema', () => {
  it('transactions', () => {
    expect(() => TransactionResponse.parse(f.transaction())).not.toThrow();
    const items = [f.transaction(), f.transaction({ account: 'savings', type: 'income' })];
    expect(() => TransactionListResponse.parse(f.page(items))).not.toThrow();
    expect(() =>
      TransactionListResponse.parse(f.page(items, { total: 42, limit: 2, offset: 20 })),
    ).not.toThrow();
  });

  it('projects', () => {
    for (const p of Object.values(f.projects)) expect(() => ProjectResponse.parse(p)).not.toThrow();
    expect(() => ProjectListResponse.parse(f.projectList())).not.toThrow();
    expect(ProjectResponse.parse(f.projects.renovation).overBudget).toBe(true);
  });

  it('accounts', () => {
    expect(() => AccountsResponse.parse(f.accounts())).not.toThrow();
    expect(() => AccountsResponse.parse(f.emptyAccounts())).not.toThrow();
  });

  it('stats', () => {
    expect(() => StatsResponse.parse(f.sampleStats())).not.toThrow();
    expect(() =>
      StatsResponse.parse(f.stats('2025-12', [{ income: 0, expense: 0 }])),
    ).not.toThrow();
  });

  it('events, one of each type', () => {
    const events = f.sampleEvents();
    expect(new Set(events.map((e) => e.type)).size).toBe(6);
    expect(() => EventListResponse.parse(f.page(events))).not.toThrow();
  });

  it('errors', () => {
    expect(() =>
      ApiErrorSchema.parse(f.apiError('validation_error', 'bad', [{ path: 'x', message: 'y' }])),
    ).not.toThrow();
  });

  it('the schema catches a drifted fixture', () => {
    const drifted = { ...f.sampleStats(), to: '2027-01' };
    expect(StatsResponse.safeParse(drifted).success).toBe(false);
  });
});
