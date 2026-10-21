import { describe, expect, it } from 'vitest';
import {
  AccountSummaryParams,
  AccountSummaryResponse,
  ApiErrorSchema,
  CreateProjectRequest,
  apiError,
  toValidationIssues,
} from '../src/index.js';

describe('toValidationIssues', () => {
  it('maps zod issues to dotted paths and messages', () => {
    const result = CreateProjectRequest.safeParse({ name: '', budgetCents: -1 });
    const issues = toValidationIssues(result.error!);
    expect(issues.map((issue) => issue.path).sort()).toEqual(['budgetCents', 'name']);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });
});

describe('apiError', () => {
  it('builds a body that satisfies the error schema', () => {
    const body = apiError('validation_error', 'Invalid request', [
      { path: 'name', message: 'too short' },
    ]);
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it('defaults to no issues', () => {
    expect(apiError('not_found', 'Project not found').error.issues).toEqual([]);
  });

  it('rejects an unknown code', () => {
    const body = { error: { code: 'teapot', message: 'x', issues: [] } };
    expect(ApiErrorSchema.safeParse(body).success).toBe(false);
  });
});

describe('account summary', () => {
  it('only accepts the main and savings views', () => {
    expect(AccountSummaryParams.safeParse({ view: 'main' }).success).toBe(true);
    expect(AccountSummaryParams.safeParse({ view: 'savings' }).success).toBe(true);
    expect(AccountSummaryParams.safeParse({ view: 'all' }).success).toBe(false);
  });

  it('allows a negative balance', () => {
    const summary = { view: 'main', incomeCents: 100, expenseCents: 500, balanceCents: -400 };
    expect(AccountSummaryResponse.safeParse(summary).success).toBe(true);
  });

  it('rejects negative income or expense totals', () => {
    const summary = { view: 'main', incomeCents: -1, expenseCents: 0, balanceCents: 0 };
    expect(AccountSummaryResponse.safeParse(summary).success).toBe(false);
  });
});
