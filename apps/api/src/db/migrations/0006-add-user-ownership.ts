import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate.js';

/**
 * Owner of the rows that existed before accounts did (development databases only). The account
 * cannot log in: `!` is not a valid password hash, so every password fails.
 */
const LEGACY_OWNER = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'legacy-owner@example.invalid',
  displayName: 'Data from before accounts',
  passwordHash: '!',
};

/**
 * Every project, transaction and event now belongs to a user (`user_id NOT NULL`). SQLite cannot
 * add a NOT NULL foreign key column, so each table is rebuilt: create the new table, copy, drop
 * the old one, rename, recreate the indexes.
 *
 * - Project names are unique per user (`user_id, name_key`).
 * - A transaction's project tag must belong to the same user: the foreign key is
 *   `(project_id, user_id) -> projects (id, user_id)`, so the database itself refuses a tag on
 *   another user's project.
 * - Existing rows are given to `LEGACY_OWNER`, which is created only when such rows exist.
 * - The event log keeps its sequence numbers and its AUTOINCREMENT counter.
 *
 * The new transactions table first references `projects_new`; renaming `projects_new` to
 * `projects` rewrites that reference, so no foreign key ever points at a dropped table.
 */
const SQL = `
  INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
  SELECT '${LEGACY_OWNER.id}', '${LEGACY_OWNER.email}', '${LEGACY_OWNER.displayName}',
         '${LEGACY_OWNER.passwordHash}',
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE EXISTS (SELECT 1 FROM projects)
     OR EXISTS (SELECT 1 FROM transactions)
     OR EXISTS (SELECT 1 FROM events);

  CREATE TABLE projects_new (
    id           TEXT    NOT NULL PRIMARY KEY,
    user_id      TEXT    NOT NULL REFERENCES users (id),
    name         TEXT    NOT NULL,
    name_key     TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    budget_cents INTEGER CHECK (budget_cents IS NULL OR budget_cents > 0),
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    UNIQUE (id, user_id)
  );
  INSERT INTO projects_new
    (id, user_id, name, name_key, description, budget_cents, created_at, updated_at)
  SELECT id, '${LEGACY_OWNER.id}', name, name_key, description, budget_cents, created_at, updated_at
  FROM projects;

  CREATE TABLE transactions_new (
    id           TEXT    NOT NULL PRIMARY KEY,
    user_id      TEXT    NOT NULL REFERENCES users (id),
    account      TEXT    NOT NULL CHECK (account IN ('main', 'savings')),
    type         TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    date         TEXT    NOT NULL,
    description  TEXT    NOT NULL,
    project_id   TEXT,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    FOREIGN KEY (project_id, user_id) REFERENCES projects_new (id, user_id)
  );
  INSERT INTO transactions_new
    (id, user_id, account, type, amount_cents, date, description, project_id, created_at, updated_at)
  SELECT id, '${LEGACY_OWNER.id}', account, type, amount_cents, date, description, project_id,
         created_at, updated_at
  FROM transactions;

  CREATE TABLE events_new (
    sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
    id          TEXT    NOT NULL UNIQUE,
    user_id     TEXT    NOT NULL REFERENCES users (id),
    type        TEXT    NOT NULL,
    occurred_at TEXT    NOT NULL,
    payload     TEXT    NOT NULL CHECK (json_valid(payload))
  );
  INSERT INTO events_new (sequence, id, user_id, type, occurred_at, payload)
  SELECT sequence, id, '${LEGACY_OWNER.id}', type, occurred_at, payload FROM events;
  -- Keep the counter even if the newest events were never committed, so no sequence is reused.
  UPDATE sqlite_sequence
  SET seq = (SELECT seq FROM sqlite_sequence WHERE name = 'events')
  WHERE name = 'events_new'
    AND seq < (SELECT seq FROM sqlite_sequence WHERE name = 'events');

  DROP TABLE transactions;
  DROP TABLE projects;
  DROP TABLE events;
  ALTER TABLE projects_new RENAME TO projects;
  ALTER TABLE transactions_new RENAME TO transactions;
  ALTER TABLE events_new RENAME TO events;

  CREATE UNIQUE INDEX projects_user_name_key_unique ON projects (user_id, name_key);
  CREATE INDEX transactions_user_date ON transactions (user_id, date);
  CREATE INDEX transactions_user_account ON transactions (user_id, account);
  CREATE INDEX transactions_project ON transactions (project_id, user_id);
  CREATE INDEX events_user_sequence ON events (user_id, sequence);
  CREATE INDEX events_user_type ON events (user_id, type, sequence);
`;

function up(db: Database): void {
  db.exec(SQL);
  const violations = db.pragma('foreign_key_check') as unknown[];
  if (violations.length > 0) {
    throw new Error(`foreign key check failed after adding ownership: ${violations.length} rows`);
  }
}

const migration: Migration = { version: 6, name: 'add-user-ownership', up };

export default migration;
export { LEGACY_OWNER };
