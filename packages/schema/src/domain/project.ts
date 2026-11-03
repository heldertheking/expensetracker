import { z } from 'zod';
import { Id } from './id.js';
import { MoneyCents } from './money.js';
import { Timestamp } from './timestamp.js';
import { text } from './text.js';

const PROJECT_NAME_MAX = 80;
const PROJECT_DESCRIPTION_MAX = 500;

const ProjectName = text(PROJECT_NAME_MAX);
const ProjectDescription = z.string().trim().max(PROJECT_DESCRIPTION_MAX);

/**
 * The stored part of a project, without derived totals. The budget is the initial budget: it is
 * set at creation, can never change, and is a guide rather than a hard ceiling.
 */
const ProjectRecordSchema = z.object({
  id: Id,
  name: ProjectName,
  description: ProjectDescription,
  budgetCents: MoneyCents.nullable(), // null = project has no budget
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
type ProjectRecord = z.infer<typeof ProjectRecordSchema>;

/**
 * A project is a tag on transactions. Every tagged transaction counts towards the project,
 * whichever account it was booked on: expenses use up the budget, income refills it, so
 * `remainingCents = budgetCents - expenseCents + incomeCents` and may go negative.
 * The totals are derived by the server and never accepted from a client.
 */
const ProjectSchema = ProjectRecordSchema.extend({
  incomeCents: z.number().int().nonnegative(),
  expenseCents: z.number().int().nonnegative(),
  remainingCents: z.number().int().nullable(), // remainder of the budget, null without budget
  overBudget: z.boolean(),
})
  .refine((p) => (p.budgetCents === null) === (p.remainingCents === null), {
    error: 'remainingCents must be set exactly when the project has a budget',
    path: ['remainingCents'],
  })
  .refine(
    (p) =>
      p.budgetCents === null || p.remainingCents === p.budgetCents - p.expenseCents + p.incomeCents,
    {
      error: 'remainingCents must equal budgetCents - expenseCents + incomeCents',
      path: ['remainingCents'],
    },
  )
  .refine((p) => p.overBudget === (p.remainingCents !== null && p.remainingCents < 0), {
    error: 'overBudget must be true exactly when remainingCents is negative',
    path: ['overBudget'],
  });

type Project = z.infer<typeof ProjectSchema>;

export {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
  ProjectDescription,
  ProjectName,
  ProjectRecordSchema,
  ProjectSchema,
};
export type { Project, ProjectRecord };
