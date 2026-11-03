import Sqlite from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';
import { migrations } from './migrations/index.js';

const IN_MEMORY = ':memory:';

/** `apps/api/data/expensetracker.db`, from both `src/` (tsx) and `dist/` (build). Gitignored. */
function defaultDatabasePath(): string {
  return fileURLToPath(new URL('../../data/expensetracker.db', import.meta.url));
}

/**
 * Opens (or creates) the database, enforces foreign keys and brings the schema up to date.
 * Files use WAL so readers do not block the writer; `:memory:` is for tests.
 */
function openDatabase(path: string = IN_MEMORY): Database {
  const db = new Sqlite(path);
  db.pragma('busy_timeout = 5000'); // wait for another process's write lock instead of failing
  db.pragma('foreign_keys = ON');
  if (path !== IN_MEMORY) retryWhileLocked(() => db.pragma('journal_mode = WAL'));
  runMigrations(db, migrations);
  return db;
}

/**
 * Switching a fresh file to WAL can report "database is locked" without honouring busy_timeout
 * while another process opens the same file. WAL is stored in the file once set, so retrying
 * briefly is enough.
 */
function retryWhileLocked<T>(work: () => T, attempts = 50, delayMs = 20): T {
  for (let attempt = 1; ; attempt++) {
    try {
      return work();
    } catch (error) {
      const locked = error instanceof Sqlite.SqliteError && error.code === 'SQLITE_BUSY';
      if (!locked || attempt >= attempts) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs); // synchronous sleep
    }
  }
}

export { defaultDatabasePath, openDatabase, retryWhileLocked };
export type { Database };
