import { z } from 'zod';
import { Id } from '../domain/id.js';
import { MoneyCents } from '../domain/money.js';
import { ProjectDescription, ProjectName, ProjectSchema } from '../domain/project.js';
import type { Project } from '../domain/project.js';
import type { ValidationIssue } from './errors.js';
import { readonlyFields, SERVER_MANAGED } from './readonly.js';
import { changedFields, NOTHING_CHANGED } from './update.js';

const serverManaged = readonlyFields(
  ['id', 'incomeCents', 'expenseCents', 'remainingCents', 'overBudget', 'createdAt', 'updatedAt'],
  SERVER_MANAGED,
);

/** The budget can only be given here. It is the initial budget and is fixed from then on. */
const CreateProjectRequest = z.strictObject({
  name: ProjectName,
  description: ProjectDescription.default(''),
  budgetCents: MoneyCents.nullable().default(null),
  ...serverManaged,
});
type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

const UPDATABLE_PROJECT_FIELDS = ['name', 'description'] as const;

const UpdateProjectRequest = z
  .strictObject({
    name: ProjectName.optional(),
    description: ProjectDescription.optional(),
    budgetCents: z
      .never({ error: 'budgetCents is fixed at creation and cannot be changed' })
      .optional(),
    ...serverManaged,
  })
  .refine((patch) => UPDATABLE_PROJECT_FIELDS.some((field) => patch[field] !== undefined), {
    error: 'at least one of name or description must be sent',
  });
type UpdateProjectRequest = z.infer<typeof UpdateProjectRequest>;

/** Checks that need the stored project. Run after the request itself has been parsed. */
function validateProjectUpdate(existing: Project, patch: UpdateProjectRequest): ValidationIssue[] {
  if (changedFields(existing, patch, UPDATABLE_PROJECT_FIELDS).length === 0) {
    return [{ path: '', message: NOTHING_CHANGED }];
  }
  return [];
}

const ProjectParams = z.strictObject({ id: Id });

const ProjectResponse = ProjectSchema;
type ProjectResponse = z.infer<typeof ProjectResponse>;

const ProjectListResponse = z.object({ items: z.array(ProjectSchema) });
type ProjectListResponse = z.infer<typeof ProjectListResponse>;

export { CreateProjectRequest, ProjectListResponse, ProjectParams, ProjectResponse };
export { UpdateProjectRequest, validateProjectUpdate };
