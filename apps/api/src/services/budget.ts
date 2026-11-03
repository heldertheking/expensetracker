import type { Project, ProjectRecord } from '@expensetracker/schema';

/** Sums of the transactions tagged with one project, from both accounts. */
interface ProjectSums {
  incomeCents: number;
  expenseCents: number;
}

/**
 * Adds the derived totals to a stored project: tagged expenses use up the budget, tagged income
 * refills it, `remainingCents = budgetCents - expenseCents + incomeCents`.
 */
function withProjectTotals(project: ProjectRecord, sums: ProjectSums): Project {
  const remainingCents =
    project.budgetCents === null
      ? null
      : project.budgetCents - sums.expenseCents + sums.incomeCents;
  return {
    ...project,
    incomeCents: sums.incomeCents,
    expenseCents: sums.expenseCents,
    remainingCents,
    overBudget: remainingCents !== null && remainingCents < 0,
  };
}

export { withProjectTotals };
export type { ProjectSums };
