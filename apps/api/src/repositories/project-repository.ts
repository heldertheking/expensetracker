import type { Database } from 'better-sqlite3';
import type { ProjectRecord } from '@expensetracker/schema';

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  name_key: string;
  description: string;
  budget_cents: number | null;
  created_at: string;
  updated_at: string;
}

const toProject = (row: ProjectRow): ProjectRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
  budgetCents: row.budget_cents,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

/** Unicode-aware, case-insensitive key for a project name ("Ärger" and "ärger" share one). */
const nameKey = (name: string): string => name.normalize('NFC').toLocaleLowerCase('de-CH');

const toRow = (userId: string, project: ProjectRecord): ProjectRow => ({
  id: project.id,
  user_id: userId,
  name: project.name,
  name_key: nameKey(project.name),
  description: project.description,
  budget_cents: project.budgetCents,
  created_at: project.createdAt.toISOString(),
  updated_at: project.updatedAt.toISOString(),
});

/**
 * SQL access to the `projects` table, scoped to the signed-in user in every query.
 * Only stored fields; totals come from the user's transactions.
 */
function createProjectRepository(db: Database) {
  const selectAll = db.prepare<[string], ProjectRow>(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY name_key, name',
  );
  const selectById = db.prepare<[string, string], ProjectRow>(
    'SELECT * FROM projects WHERE user_id = ? AND id = ?',
  );
  const selectByName = db.prepare<[string, string], ProjectRow>(
    'SELECT * FROM projects WHERE user_id = ? AND name_key = ?',
  );
  const insert = db.prepare<[ProjectRow]>(
    `INSERT INTO projects
       (id, user_id, name, name_key, description, budget_cents, created_at, updated_at)
     VALUES
       (@id, @user_id, @name, @name_key, @description, @budget_cents, @created_at, @updated_at)`,
  );
  const update = db.prepare<[ProjectRow]>(
    `UPDATE projects
     SET name = @name, name_key = @name_key, description = @description, updated_at = @updated_at
     WHERE user_id = @user_id AND id = @id`,
  );
  const remove = db.prepare<[string, string]>('DELETE FROM projects WHERE user_id = ? AND id = ?');
  const count = db.prepare<[string], { n: number }>(
    'SELECT COUNT(*) AS n FROM projects WHERE user_id = ?',
  );

  return {
    /** All projects of the user, by name. */
    list: (userId: string): ProjectRecord[] => selectAll.all(userId).map(toProject),
    findById: (userId: string, id: string): ProjectRecord | undefined => {
      const row = selectById.get(userId, id);
      return row && toProject(row);
    },
    /** Case-insensitive (also for umlauts), within the user's projects. */
    findByName: (userId: string, name: string): ProjectRecord | undefined => {
      const row = selectByName.get(userId, nameKey(name));
      return row && toProject(row);
    },
    insert: (userId: string, project: ProjectRecord): void => {
      insert.run(toRow(userId, project));
    },
    /** Writes name, description and updatedAt; the budget is fixed at creation. */
    update: (userId: string, project: ProjectRecord): void => {
      update.run(toRow(userId, project));
    },
    delete: (userId: string, id: string): void => {
      remove.run(userId, id);
    },
    count: (userId: string): number => count.get(userId)!.n,
  };
}

type ProjectRepository = ReturnType<typeof createProjectRepository>;

export { createProjectRepository, nameKey };
export type { ProjectRepository };
