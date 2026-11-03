import { validateProjectUpdate } from '@expensetracker/schema';
import type { ProjectRecord } from '@expensetracker/schema';
import { conflict, invalid, notFound } from '../../errors.js';
import { withProjectTotals } from '../../services/budget.js';
import { sumsOf } from '../../services/read-services.js';
import type { EventHandler } from '../types.js';
import type { HandlerDeps } from './deps.js';

/** Names are unique per user ignoring case; a project may keep (or re-case) its own name. */
function assertNameAvailable(
  deps: HandlerDeps,
  userId: string,
  name: string,
  ownId?: string,
): void {
  const holder = deps.projects.findByName(userId, name);
  if (holder !== undefined && holder.id !== ownId) {
    throw conflict(`a project named "${holder.name}" already exists`, [
      { path: 'name', message: 'project names must be unique' },
    ]);
  }
}

function existingProject(deps: HandlerDeps, userId: string, id: string): ProjectRecord {
  const project = deps.projects.findById(userId, id);
  if (project === undefined) throw notFound('project', id);
  return project;
}

function createProjectHandler(deps: HandlerDeps): EventHandler<'CreateProjectEvent', void> {
  return {
    validate: (userId, data) => assertNameAvailable(deps, userId, data.name),
    handle: (userId, data) => {
      const now = deps.clock();
      const project: ProjectRecord = {
        id: deps.newId(),
        name: data.name,
        description: data.description,
        budgetCents: data.budgetCents,
        createdAt: now,
        updatedAt: now,
      };
      deps.projects.insert(userId, project);
      return { result: project, payload: { project } };
    },
  };
}

function updateProjectHandler(
  deps: HandlerDeps,
): EventHandler<'UpdateProjectEvent', ProjectRecord> {
  return {
    validate: (userId, { id, patch }) => {
      const existing = existingProject(deps, userId, id);
      const withTotals = withProjectTotals(
        existing,
        sumsOf(deps.transactions.totalsByProject(userId), id),
      );
      const issues = validateProjectUpdate(withTotals, patch);
      if (issues.length > 0) throw invalid(issues);
      if (patch.name !== undefined) assertNameAvailable(deps, userId, patch.name, id);
      return existing;
    },
    handle: (userId, { patch }, before) => {
      const after: ProjectRecord = {
        ...before,
        name: patch.name ?? before.name,
        description: patch.description ?? before.description,
        updatedAt: deps.clock(),
      };
      deps.projects.update(userId, after);
      return { result: after, payload: { before, after } };
    },
  };
}

/** A project that still tags transactions cannot be deleted (409): untag or delete them first. */
function deleteProjectHandler(
  deps: HandlerDeps,
): EventHandler<'DeleteProjectEvent', ProjectRecord> {
  return {
    validate: (userId, { id }) => {
      const project = existingProject(deps, userId, id);
      const tagged = deps.transactions.countByProject(userId, id);
      if (tagged > 0) {
        throw conflict(
          `project "${project.name}" still tags ${tagged} transaction(s); untag or delete them first`,
        );
      }
      return project;
    },
    handle: (userId, _data, project) => {
      deps.projects.delete(userId, project.id);
      return { result: project, payload: { project } };
    },
  };
}

export { createProjectHandler, deleteProjectHandler, updateProjectHandler };
