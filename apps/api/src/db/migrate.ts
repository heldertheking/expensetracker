import type { Database } from 'better-sqlite3';

/**
 * One forward-only schema change; applied migrations never change. `up` is the SQL to run, or a
 * function for a migration that must also check its result (e.g. `PRAGMA foreign_key_check`).
 */
interface Migration {
  version: number;
  name: string;
  up: string | ((db: Database) => void);
}

interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: string;
}

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    applied_at TEXT    NOT NULL
  )`;

/** Versions must be 1, 2, 3, ... in order, so a gap or a duplicate is caught before anything runs. */
function assertConsecutive(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `migration ${migration.name} has version ${migration.version}, expected ${index + 1}`,
      );
    }
  });
}

function appliedMigrations(db: Database): AppliedMigration[] {
  db.exec(CREATE_MIGRATIONS_TABLE);
  return db
    .prepare(
      'SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version',
    )
    .all() as AppliedMigration[];
}

/**
 * Applies every pending migration in ascending order, each in its own transaction together with
 * its `schema_migrations` row. Returns the versions applied by this call. Each transaction is
 * IMMEDIATE and checks again whether its migration is still pending, so two processes opening
 * the same fresh database never apply a migration twice.
 */
function runMigrations(
  db: Database,
  migrations: readonly Migration[],
  now: () => Date = () => new Date(),
): number[] {
  assertConsecutive(migrations);
  const done = new Set(appliedMigrations(db).map((m) => m.version));
  const record = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );
  const isApplied = db.prepare<[number]>('SELECT 1 FROM schema_migrations WHERE version = ?');
  const applied: number[] = [];

  for (const migration of migrations) {
    if (done.has(migration.version)) continue;
    const ran = db
      .transaction(() => {
        if (isApplied.get(migration.version) !== undefined) return false; // another process won
        if (typeof migration.up === 'string') db.exec(migration.up);
        else migration.up(db);
        record.run(migration.version, migration.name, now().toISOString());
        return true;
      })
      .immediate();
    if (ran) applied.push(migration.version);
  }
  return applied;
}

export { appliedMigrations, runMigrations };
export type { AppliedMigration, Migration };
