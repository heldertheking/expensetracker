import { CreateProjectRequest, CreateTransactionRequest } from '@expensetracker/schema';
import type { Core } from '../app.js';
import type { SeedData } from './data.js';

/**
 * Writes the seed data through the event bus, exactly like the API would, so every record also
 * lands in the event log. Refuses to touch a database that already holds data. All or nothing:
 * the whole seed runs in one transaction, so a failure leaves the database empty.
 */
function seedDatabase(core: Pick<Core, 'bus' | 'repositories' | 'inTransaction'>, data: SeedData) {
  return core.inTransaction(() => seedInTransaction(core, data));
}

function seedInTransaction(core: Pick<Core, 'bus' | 'repositories'>, data: SeedData) {
  const { projects, transactions } = core.repositories;
  if (projects.count() > 0 || transactions.count() > 0) {
    throw new Error('the database already holds data; seed only an empty database');
  }

  const projectIds = new Map<string, string>();
  for (const project of data.projects) {
    const created = core.bus.dispatch('CreateProjectEvent', CreateProjectRequest.parse(project));
    projectIds.set(created.name, created.id);
  }

  for (const { project, ...transaction } of data.transactions) {
    const projectId = project === undefined ? null : projectIds.get(project);
    if (projectId === undefined) throw new Error(`seed data tags unknown project "${project}"`);
    core.bus.dispatch(
      'CreateTransactionEvent',
      CreateTransactionRequest.parse({ ...transaction, projectId }),
    );
  }

  return { projects: data.projects.length, transactions: data.transactions.length };
}

export { seedDatabase };
