import { describe, expect, it } from 'vitest';
import {
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
