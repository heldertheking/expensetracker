import { validateProjectUpdate } from '@expensetracker/schema';
import type { ProjectRecord } from '@expensetracker/schema';
import { conflict, invalid, notFound } from '../../errors.js';
import { withProjectTotals } from '../../services/budget.js';
import { sumsOf } from '../../services/read-services.js';
import type { EventHandler } from '../types.js';
import type { HandlerDeps } from './deps.js';

/** Names are unique ignoring case; a project may keep (or re-case) its own name. */
function assertNameAvailable(deps: HandlerDeps, name: string, ownId?: string): void {
  const holder = deps.projects.findByName(name);
  if (holder !== undefined && holder.id !== ownId) {
    throw conflict(`a project named "${holder.name}" already exists`, [
      { path: 'name', message: 'project names must be unique' },
    ]);
  }
}

function existingProject(deps: HandlerDeps, id: string): ProjectRecord {
  const project = deps.projects.findById(id);
  if (project === undefined) throw notFound('project', id);
  return project;
}

function createProjectHandler(deps: HandlerDeps): EventHandler<'CreateProjectEvent', void> {
  return {
    validate: (data) => assertNameAvailable(deps, data.name),
    handle: (data) => {
      const now = deps.clock();
      const project: ProjectRecord = {
        id: deps.newId(),
        name: data.name,
        description: data.description,
        budgetCents: data.budgetCents,
        createdAt: now,
        updatedAt: now,
      };
      deps.projects.insert(project);
      return { result: project, payload: { project } };
    },
  };
}

function updateProjectHandler(
  deps: HandlerDeps,
): EventHandler<'UpdateProjectEvent', ProjectRecord> {
  return {
    validate: ({ id, patch }) => {
      const existing = existingProject(deps, id);
      const withTotals = withProjectTotals(
        existing,
        sumsOf(deps.transactions.totalsByProject(), id),
      );
      const issues = validateProjectUpdate(withTotals, patch);
      if (issues.length > 0) throw invalid(issues);
      if (patch.name !== undefined) assertNameAvailable(deps, patch.name, id);
      return existing;
    },
    handle: ({ patch }, before) => {
      const after: ProjectRecord = {
        ...before,
        name: patch.name ?? before.name,
        description: patch.description ?? before.description,
        updatedAt: deps.clock(),
      };
      deps.projects.update(after);
      return { result: after, payload: { before, after } };
    },
  };
}

/** A project that still tags transactions cannot be deleted (409): untag or delete them first. */
function deleteProjectHandler(
  deps: HandlerDeps,
): EventHandler<'DeleteProjectEvent', ProjectRecord> {
  return {
    validate: ({ id }) => {
      const project = existingProject(deps, id);
      const tagged = deps.transactions.countByProject(id);
      if (tagged > 0) {
        throw conflict(
          `project "${project.name}" still tags ${tagged} transaction(s); untag or delete them first`,
        );
      }
      return project;
    },
    handle: (_data, project) => {
      deps.projects.delete(project.id);
      return { result: project, payload: { project } };
    },
  };
}

export { createProjectHandler, deleteProjectHandler, updateProjectHandler };
