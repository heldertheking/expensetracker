import { CreateProjectRequest, CreateTransactionRequest } from '@expensetracker/schema';
import type { User } from '@expensetracker/schema';
import type { Core } from '../app.js';
import { DEMO_USER } from './data.js';
import type { SeedAccountCredentials, SeedData, SeedProject, SeedTransaction } from './data.js';

type SeedCore = Pick<Core, 'bus' | 'repositories' | 'inTransaction' | 'hasher' | 'clock' | 'newId'>;

interface SeedResult {
  users: User[];
  projects: number;
  transactions: number;
}

function seedUserRecords(
  core: SeedCore,
  userId: string,
  projects: SeedProject[],
  transactions: SeedTransaction[],
): void {
  const projectIds = new Map<string, string>();
  for (const project of projects) {
    const created = core.bus.dispatch(
      userId,
      'CreateProjectEvent',
      CreateProjectRequest.parse(project),
    );
    projectIds.set(created.name, created.id);
  }

  for (const { project, ...transaction } of transactions) {
    const projectId = project === undefined ? null : projectIds.get(project);
    if (projectId === undefined) throw new Error(`seed data tags unknown project "${project}"`);
    core.bus.dispatch(
      userId,
      'CreateTransactionEvent',
      CreateTransactionRequest.parse({ ...transaction, projectId }),
    );
  }
}

/**
 * Writes the seed users and their data through the event bus, exactly like the API would, so
 * every record also lands in the event log. Refuses to touch a database that already holds
 * data. All or nothing: the whole seed runs in one transaction, so a failure leaves the
 * database empty.
 */
async function seedDatabase(core: SeedCore, data: SeedData): Promise<SeedResult> {
  const { users, projects, transactions } = core.repositories;
  const primarySpec: SeedAccountCredentials = data.user ?? DEMO_USER;

  if (users.count() > 0) {
    throw new Error('the database already holds data; seed only an empty database');
  }

  const primaryHash = await core.hasher.hash(primarySpec.password);
  const secondaryHash = data.secondaryUser
    ? await core.hasher.hash(data.secondaryUser.password)
    : undefined;

  return core.inTransaction(() => {
    if (users.count() > 0) {
      throw new Error('the database already holds data; seed only an empty database');
    }

    const now = core.clock();
    const primaryUser = users.insert({
      id: core.newId(),
      email: primarySpec.email,
      displayName: primarySpec.displayName,
      passwordHash: primaryHash,
      createdAt: now,
      updatedAt: now,
    });

    if (projects.count(primaryUser.id) > 0 || transactions.count(primaryUser.id) > 0) {
      throw new Error('the database already holds data; seed only an empty database');
    }

    seedUserRecords(core, primaryUser.id, data.projects, data.transactions);

    const createdUsers: User[] = [primaryUser];
    if (data.secondaryUser !== undefined && secondaryHash !== undefined) {
      const secondaryUser = users.insert({
        id: core.newId(),
        email: data.secondaryUser.email,
        displayName: data.secondaryUser.displayName,
        passwordHash: secondaryHash,
        createdAt: now,
        updatedAt: now,
      });
      seedUserRecords(
        core,
        secondaryUser.id,
        data.secondaryUser.projects,
        data.secondaryUser.transactions,
      );
      createdUsers.push(secondaryUser);
    }

    return {
      users: createdUsers,
      projects: data.projects.length,
      transactions: data.transactions.length,
    };
  });
}

export { seedDatabase };
export type { SeedCore, SeedResult };
