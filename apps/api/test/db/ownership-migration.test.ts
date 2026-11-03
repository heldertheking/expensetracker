import Sqlite from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appliedMigrations, runMigrations } from '../../src/db/migrate.js';
import { migrations } from '../../src/db/migrations/index.js';
import { LEGACY_OWNER } from '../../src/db/migrations/0006-add-user-ownership.js';
import { createPasswordHasher } from '../../src/auth/password.js';

const now = () => new Date('2026-11-03T10:00:00.000Z');
const V3 = migrations.slice(0, 3);

const count = (db: Database, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

const indexNames = (db: Database, table: string) =>
  (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name",
      )
      .all(table) as { name: string }[]
  ).map((row) => row.name);

/** A database as it was at version 3, before accounts existed, with some data in it. */
function seedV3(db: Database) {
  runMigrations(db, V3, now);
  db.exec(`
    INSERT INTO projects (id, name, name_key, description, budget_cents, created_at, updated_at)
    VALUES ('p1', 'Holiday', 'holiday', 'Trip', 100000, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    INSERT INTO transactions (id, account, type, amount_cents, date, description, project_id, created_at, updated_at)
    VALUES
      ('t1', 'main', 'expense', 5000, '2026-10-02', 'Hotel', 'p1', '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z'),
      ('t2', 'savings', 'income', 700, '2026-10-03', 'Interest', NULL, '2026-10-03T00:00:00.000Z', '2026-10-03T00:00:00.000Z');
    INSERT INTO events (id, type, occurred_at, payload) VALUES
      ('e1', 'CreateProjectEvent', '2026-10-01T00:00:00.000Z', '{}'),
      ('e2', 'CreateTransactionEvent', '2026-10-02T00:00:00.000Z', '{}'),
      ('e3', 'CreateTransactionEvent', '2026-10-03T00:00:00.000Z', '{}'),
      ('e4', 'DeleteTransactionEvent', '2026-10-04T00:00:00.000Z', '{}');
    -- The newest event was rolled back in production terms: the counter stays ahead of the rows.
    DELETE FROM events WHERE id = 'e4';
  `);
}

describe('migration 0006 add-user-ownership', () => {
  let db: Database;

  beforeEach(() => {
    db = new Sqlite(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => db.close());

  it('creates no placeholder user on a database without data', () => {
    runMigrations(db, migrations, now);

    expect(count(db, 'users')).toBe(0);
  });

  describe('on a version 3 database with data', () => {
    beforeEach(() => {
      seedV3(db);
      expect(runMigrations(db, migrations, now)).toEqual([4, 5, 6]);
    });

    it('keeps every row and gives it to the placeholder user', () => {
      expect(count(db, 'projects')).toBe(1);
      expect(count(db, 'transactions')).toBe(2);
      expect(count(db, 'events')).toBe(3);
      for (const table of ['projects', 'transactions', 'events']) {
        expect(db.prepare(`SELECT DISTINCT user_id FROM ${table}`).all()).toEqual([
          { user_id: LEGACY_OWNER.id },
        ]);
      }
      expect(db.prepare("SELECT * FROM transactions WHERE id = 't1'").get()).toMatchObject({
        account: 'main',
        type: 'expense',
        amount_cents: 5000,
        date: '2026-10-02',
        description: 'Hotel',
        project_id: 'p1',
        created_at: '2026-10-02T00:00:00.000Z',
      });
      expect(db.prepare("SELECT * FROM projects WHERE id = 'p1'").get()).toMatchObject({
        name: 'Holiday',
        name_key: 'holiday',
        budget_cents: 100000,
      });
    });

    it('creates a placeholder user that can never log in', async () => {
      const owner = db.prepare('SELECT * FROM users').all() as {
        id: string;
        email: string;
        password_hash: string;
      }[];

      expect(owner).toHaveLength(1);
      expect(owner[0]).toMatchObject({ id: LEGACY_OWNER.id, email: LEGACY_OWNER.email });
      const hasher = createPasswordHasher({ N: 2 ** 10, r: 8, p: 1 });
      for (const guess of ['!', '', 'password', LEGACY_OWNER.email]) {
        expect((await hasher.verify(guess, owner[0]!.password_hash)).ok).toBe(false);
      }
    });

    it('keeps event sequences and never reuses one', () => {
      expect(db.prepare('SELECT id, sequence FROM events ORDER BY sequence').all()).toEqual([
        { id: 'e1', sequence: 1 },
        { id: 'e2', sequence: 2 },
        { id: 'e3', sequence: 3 },
      ]);

      db.prepare(
        `INSERT INTO events (id, user_id, type, occurred_at, payload)
         VALUES ('e5', ?, 'CreateProjectEvent', 'now', '{}')`,
      ).run(LEGACY_OWNER.id);

      expect(db.prepare("SELECT sequence FROM events WHERE id = 'e5'").get()).toEqual({
        sequence: 5,
      });
    });

    it('leaves no foreign key violation and no leftover table', () => {
      expect(db.pragma('foreign_key_check')).toEqual([]);
      const tables = (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string;
        }[]
      ).map((t) => t.name);
      expect(tables.filter((name) => name.endsWith('_new'))).toEqual([]);
    });

    it('recreates the indexes for per-user queries', () => {
      expect(indexNames(db, 'projects')).toEqual(['projects_user_name_key_unique']);
      expect(indexNames(db, 'transactions')).toEqual([
        'transactions_project',
        'transactions_user_account',
        'transactions_user_date',
      ]);
      expect(indexNames(db, 'events')).toEqual(['events_user_sequence', 'events_user_type']);
    });

    it('makes user_id required from now on', () => {
      expect(() =>
        db
          .prepare(
            `INSERT INTO projects (id, name, name_key, created_at, updated_at)
             VALUES ('p2', 'Bike', 'bike', 'now', 'now')`,
          )
          .run(),
      ).toThrow(/NOT NULL/);
    });

    it('is recorded, so opening the database again changes nothing', () => {
      expect(appliedMigrations(db).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(runMigrations(db, migrations, now)).toEqual([]);
      expect(count(db, 'users')).toBe(1);
    });
  });

  // A tag on a project that does not exist cannot be written with foreign keys on; simulate a
  // database that was written without them.
  function seedBrokenV3() {
    runMigrations(db, V3, now);
    db.pragma('foreign_keys = OFF');
    db.exec(`
      INSERT INTO transactions (id, account, type, amount_cents, date, description, project_id, created_at, updated_at)
      VALUES ('t1', 'main', 'expense', 1, '2026-10-02', 'x', 'missing', 'now', 'now');
    `);
  }

  function expectRolledBack() {
    expect(appliedMigrations(db).map((m) => m.version)).toEqual([1, 2, 3, 4, 5]);
    expect(db.prepare('PRAGMA table_info(transactions)').all()).not.toContainEqual(
      expect.objectContaining({ name: 'user_id' }),
    );
    expect(count(db, 'users')).toBe(0);
    expect(count(db, 'transactions')).toBe(1);
  }

  it('rolls back completely when a copied row breaks a foreign key', () => {
    seedBrokenV3();
    db.pragma('foreign_keys = ON');

    expect(() => runMigrations(db, migrations, now)).toThrow(/FOREIGN KEY/);
    expectRolledBack();
  });

  it('checks foreign keys itself and rolls back even when they are not enforced', () => {
    seedBrokenV3();

    expect(() => runMigrations(db, migrations, now)).toThrow(
      /foreign key check failed after adding ownership: 1 rows/,
    );
    expectRolledBack();
  });
});
