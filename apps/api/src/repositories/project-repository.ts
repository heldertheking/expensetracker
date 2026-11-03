import type { Database } from 'better-sqlite3';
import type { ProjectRecord } from '@expensetracker/schema';

interface ProjectRow {
  id: string;
  name: string;
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

const toRow = (project: ProjectRecord): ProjectRow => ({
  id: project.id,
  name: project.name,
  description: project.description,
  budget_cents: project.budgetCents,
  created_at: project.createdAt.toISOString(),
  updated_at: project.updatedAt.toISOString(),
});

/** SQL access to the `projects` table. Only stored fields; totals come from the transactions. */
function createProjectRepository(db: Database) {
  const selectAll = db.prepare<[], ProjectRow>(
    'SELECT * FROM projects ORDER BY name COLLATE NOCASE',
  );
  const selectById = db.prepare<[string], ProjectRow>('SELECT * FROM projects WHERE id = ?');
  const selectByName = db.prepare<[string], ProjectRow>(
    'SELECT * FROM projects WHERE name = ? COLLATE NOCASE',
  );
  const insert = db.prepare<[ProjectRow]>(
    `INSERT INTO projects (id, name, description, budget_cents, created_at, updated_at)
     VALUES (@id, @name, @description, @budget_cents, @created_at, @updated_at)`,
  );
  const update = db.prepare<[ProjectRow]>(
    `UPDATE projects SET name = @name, description = @description, updated_at = @updated_at
     WHERE id = @id`,
  );
  const remove = db.prepare<[string]>('DELETE FROM projects WHERE id = ?');
  const count = db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM projects');

  return {
    /** All projects, by name. */
    list: (): ProjectRecord[] => selectAll.all().map(toProject),
    findById: (id: string): ProjectRecord | undefined => {
      const row = selectById.get(id);
      return row && toProject(row);
    },
    /** Case-insensitive, like the unique index. */
    findByName: (name: string): ProjectRecord | undefined => {
      const row = selectByName.get(name);
      return row && toProject(row);
    },
    insert: (project: ProjectRecord): void => {
      insert.run(toRow(project));
    },
    /** Writes name, description and updatedAt; the budget is fixed at creation. */
    update: (project: ProjectRecord): void => {
      update.run(toRow(project));
    },
    delete: (id: string): void => {
      remove.run(id);
    },
    count: (): number => count.get()!.n,
  };
}

type ProjectRepository = ReturnType<typeof createProjectRepository>;

export { createProjectRepository };
export type { ProjectRepository };
