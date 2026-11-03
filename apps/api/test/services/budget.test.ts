import { ProjectSchema } from '@expensetracker/schema';
import { describe, expect, it } from 'vitest';
import { withProjectTotals } from '../../src/services/budget.js';
import { makeProject } from '../fixtures.js';

describe('withProjectTotals', () => {
  const budgeted = makeProject({ budgetCents: 100_000 });

  it('keeps the stored fields and adds the tagged income and expense', () => {
    const project = withProjectTotals(budgeted, { incomeCents: 5_000, expenseCents: 20_000 });

    expect(project).toMatchObject({ ...budgeted, incomeCents: 5_000, expenseCents: 20_000 });
  });

  it('leaves the whole budget when nothing is tagged', () => {
    const project = withProjectTotals(budgeted, { incomeCents: 0, expenseCents: 0 });

    expect(project.remainingCents).toBe(100_000);
    expect(project.overBudget).toBe(false);
  });

  it('subtracts tagged expenses from the budget', () => {
    const project = withProjectTotals(budgeted, { incomeCents: 0, expenseCents: 30_000 });

    expect(project.remainingCents).toBe(70_000);
  });

  it('adds tagged income back to the budget', () => {
    const project = withProjectTotals(budgeted, { incomeCents: 10_000, expenseCents: 30_000 });

    expect(project.remainingCents).toBe(80_000);
  });

  it('is not over budget when the budget is used up exactly', () => {
    const project = withProjectTotals(budgeted, { incomeCents: 0, expenseCents: 100_000 });

    expect(project.remainingCents).toBe(0);
    expect(project.overBudget).toBe(false);
  });

  it('goes negative and flags overBudget when expenses exceed budget plus income', () => {
    const project = withProjectTotals(budgeted, { incomeCents: 5_000, expenseCents: 120_000 });

    expect(project.remainingCents).toBe(-15_000);
    expect(project.overBudget).toBe(true);
  });

  it('has no remainder and is never over budget without a budget', () => {
    const project = withProjectTotals(makeProject({ budgetCents: null }), {
      incomeCents: 0,
      expenseCents: 999_999,
    });

    expect(project.remainingCents).toBeNull();
    expect(project.overBudget).toBe(false);
  });

  it.each([
    [100_000, 0, 0],
    [100_000, 5_000, 120_000],
    [null, 1, 2],
  ])(
    'satisfies the schema for budget %s, income %s, expense %s',
    (budgetCents, income, expense) => {
      const project = withProjectTotals(makeProject({ budgetCents }), {
        incomeCents: income,
        expenseCents: expense,
      });

      expect(ProjectSchema.safeParse(project).success).toBe(true);
    },
  );
});
