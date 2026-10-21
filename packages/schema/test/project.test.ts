import { describe, expect, it } from 'vitest';
import {
  CreateProjectRequest,
  ProjectSchema,
  UpdateProjectRequest,
  validateProjectUpdate,
} from '../src/index.js';
import type { Project } from '../src/index.js';

const ID = '3f2b8c1e-5a47-4d1b-9c63-0e8d2f6a7b10';
const now = new Date('2026-01-01T00:00:00Z');

const project = (overrides: Partial<Project> = {}): Project => ({
  id: ID,
  name: 'Holiday',
  description: '',
  budgetCents: 100_000,
  incomeCents: 0,
  expenseCents: 25_000,
  remainingCents: 75_000,
  overBudget: false,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('CreateProjectRequest', () => {
  it('trims the name and defaults description and budget', () => {
    const parsed = CreateProjectRequest.parse({ name: '  Holiday  ' });
    expect(parsed).toEqual({ name: 'Holiday', description: '', budgetCents: null });
  });

  it('accepts a budget', () => {
    expect(CreateProjectRequest.parse({ name: 'Car', budgetCents: 500_000 }).budgetCents).toBe(
      500_000,
    );
  });

  it.each([
    ['blank name', { name: '   ' }],
    ['name too long', { name: 'x'.repeat(81) }],
    ['description too long', { name: 'a', description: 'x'.repeat(501) }],
    ['zero budget', { name: 'a', budgetCents: 0 }],
    ['negative budget', { name: 'a', budgetCents: -5 }],
    ['fractional budget', { name: 'a', budgetCents: 10.5 }],
    ['budget above the maximum', { name: 'a', budgetCents: 100_000_000_001 }],
    ['unknown field', { name: 'a', colour: 'red' }],
  ])('rejects %s', (_label, input) => {
    expect(CreateProjectRequest.safeParse(input).success).toBe(false);
  });

  it.each(['id', 'incomeCents', 'expenseCents', 'remainingCents', 'overBudget', 'createdAt'])(
    'explains that %s is managed by the server',
    (field) => {
      const result = CreateProjectRequest.safeParse({ name: 'a', [field]: 1 });
      expect(messages(result)).toContain(`${field} is managed by the server and cannot be set`);
    },
  );
});

describe('UpdateProjectRequest', () => {
  it('accepts a partial update', () => {
    expect(UpdateProjectRequest.parse({ name: 'New name' })).toEqual({ name: 'New name' });
  });

  it('rejects changing the budget with an explanation', () => {
    const result = UpdateProjectRequest.safeParse({ name: 'x', budgetCents: 1 });
    expect(messages(result)).toContain('budgetCents is fixed at creation and cannot be changed');
  });

  it('rejects an empty update', () => {
    expect(messages(UpdateProjectRequest.safeParse({}))).toContain(
      'at least one of name or description must be sent',
    );
  });

  it('rejects an update that only carries server-managed fields', () => {
    expect(UpdateProjectRequest.safeParse({ remainingCents: 5 }).success).toBe(false);
  });
});

describe('validateProjectUpdate', () => {
  it('rejects an update that changes nothing', () => {
    const issues = validateProjectUpdate(project(), { name: 'Holiday', description: '' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/nothing changed/);
  });

  it('accepts a real change', () => {
    expect(validateProjectUpdate(project(), { name: 'Holiday 2026' })).toEqual([]);
  });
});

describe('ProjectSchema', () => {
  it('accepts a project under budget', () => {
    expect(ProjectSchema.safeParse(project()).success).toBe(true);
  });

  it('accepts a project over budget, because the budget is not a hard ceiling', () => {
    expect(
      ProjectSchema.safeParse(project({ remainingCents: -5_000, overBudget: true })).success,
    ).toBe(true);
  });

  it('accepts a project without a budget', () => {
    const result = ProjectSchema.safeParse(
      project({ budgetCents: null, remainingCents: null, overBudget: false }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a remainder without a budget', () => {
    expect(ProjectSchema.safeParse(project({ budgetCents: null })).success).toBe(false);
  });

  it('rejects a budget without a remainder', () => {
    expect(ProjectSchema.safeParse(project({ remainingCents: null })).success).toBe(false);
  });

  it('rejects an inconsistent overBudget flag', () => {
    expect(ProjectSchema.safeParse(project({ overBudget: true })).success).toBe(false);
    expect(ProjectSchema.safeParse(project({ remainingCents: -1 })).success).toBe(false);
  });

  it('coerces timestamps that arrive as JSON strings', () => {
    const wire = { ...project(), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02' };
    expect(ProjectSchema.parse(wire).createdAt).toBeInstanceOf(Date);
  });
});
