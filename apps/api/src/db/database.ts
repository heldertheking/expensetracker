import Sqlite from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import { runMigrations } from './migrate.js';
import { migrations } from './migrations/index.js';

const IN_MEMORY = ':memory:';

/**
 * Opens (or creates) the database, enforces foreign keys and brings the schema up to date.
 * Files use WAL so readers do not block the writer; `:memory:` is for tests.
 */
function openDatabase(path: string = IN_MEMORY): Database {
  const db = new Sqlite(path);
  db.pragma('foreign_keys = ON');
  if (path !== IN_MEMORY) db.pragma('journal_mode = WAL');
  runMigrations(db, migrations);
  return db;
}

export { openDatabase };
export type { Database };
