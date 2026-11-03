import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Sqlite from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, retryWhileLocked } from '../../src/db/database.js';
import { appliedMigrations, runMigrations } from '../../src/db/migrate.js';
import type { Migration } from '../../src/db/migrate.js';
import { migrations } from '../../src/db/migrations/index.js';

const NOW = new Date('2026-11-03T10:00:00.000Z');
const now = () => NOW;

const tableNames = (db: Database) =>
  (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map((row) => row.name);

function insertUser(db: Database, id: string, email = `${id}@example.com`) {
  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
     VALUES (?, ?, 'x', 'hash', 'now', 'now')`,
  ).run(id, email);
}

function insertProject(db: Database, id: string, userId: string, nameKey = id) {
  db.prepare(
    `INSERT INTO projects (id, user_id, name, name_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'now', 'now')`,
  ).run(id, userId, nameKey, nameKey);
}

function insertTransaction(db: Database, id: string, userId: string, projectId: string | null) {
  db.prepare(
    `INSERT INTO transactions (id, user_id, account, type, amount_cents, date, description, project_id, created_at, updated_at)
     VALUES (?, ?, 'main', 'income', 1, '2026-01-01', 'x', ?, 'now', 'now')`,
  ).run(id, userId, projectId);
}

describe('runMigrations', () => {
  let db: Database;

  beforeEach(() => {
    db = new Sqlite(':memory:');
  });

  afterEach(() => db.close());

  it('applies every migration on a fresh database and records each one', () => {
    const applied = runMigrations(db, migrations, now);

    expect(applied).toEqual([1, 2, 3, 4, 5, 6]);
    expect(appliedMigrations(db)).toEqual([
      { version: 1, name: 'create-projects', appliedAt: NOW.toISOString() },
      { version: 2, name: 'create-transactions', appliedAt: NOW.toISOString() },
      { version: 3, name: 'create-events', appliedAt: NOW.toISOString() },
      { version: 4, name: 'create-users', appliedAt: NOW.toISOString() },
      { version: 5, name: 'create-sessions', appliedAt: NOW.toISOString() },
      { version: 6, name: 'add-user-ownership', appliedAt: NOW.toISOString() },
    ]);
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        'events',
        'projects',
        'schema_migrations',
        'sessions',
        'transactions',
        'users',
      ]),
    );
  });

  it('is a no-op when run again', () => {
    runMigrations(db, migrations, now);

    expect(runMigrations(db, migrations, now)).toEqual([]);
    expect(appliedMigrations(db)).toHaveLength(migrations.length);
  });

  it('applies only the migrations added since the last run', () => {
    runMigrations(db, migrations.slice(0, 1), now);

    expect(runMigrations(db, migrations, now)).toEqual([2, 3, 4, 5, 6]);
  });

  it('skips a migration that another process applied after the pending list was read', () => {
    // Version 2 records version 3 as applied, the way a second process would between our read
    // of schema_migrations and our turn for version 3.
    const racing: Migration[] = [
      { version: 1, name: 'one', up: 'CREATE TABLE one (id INTEGER)' },
      {
        version: 2,
        name: 'two',
        up: "INSERT INTO schema_migrations VALUES (3, 'three', '2026-01-01T00:00:00.000Z')",
      },
      { version: 3, name: 'three', up: 'CREATE TABLE one (id INTEGER)' }, // would fail if run
    ];

    expect(runMigrations(db, racing, now)).toEqual([1, 2]);
    expect(appliedMigrations(db).map((m) => m.version)).toEqual([1, 2, 3]);
  });

  it('rolls back a failing migration and records nothing for it', () => {
    const broken: Migration = {
      version: 2,
      name: 'broken',
      up: 'CREATE TABLE half_done (id INTEGER); INSERT INTO missing_table VALUES (1);',
    };

    expect(() => runMigrations(db, [migrations[0]!, broken], now)).toThrow(/missing_table/);

    expect(appliedMigrations(db).map((m) => m.version)).toEqual([1]);
    expect(tableNames(db)).not.toContain('half_done');
  });

  it('rejects versions that are not consecutive from 1', () => {
    const gap = [migrations[0]!, { ...migrations[2]!, version: 3 }];

    expect(() => runMigrations(db, gap, now)).toThrow(/expected 2/);
    expect(tableNames(db)).not.toContain('schema_migrations');
  });

  it('uses the current time by default', () => {
    runMigrations(db, migrations.slice(0, 1));

    expect(Date.parse(appliedMigrations(db)[0]!.appliedAt)).not.toBeNaN();
  });
});

describe('openDatabase', () => {
  it('opens an in-memory database with migrations applied and foreign keys on', () => {
    const db = openDatabase();

    expect(appliedMigrations(db)).toHaveLength(migrations.length);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });

  it('uses WAL for a file database and keeps its migrations when reopened', () => {
    const dir = mkdtempSync(join(tmpdir(), 'expensetracker-'));
    const path = join(dir, 'test.db');
    try {
      const first = openDatabase(path);
      expect(first.pragma('journal_mode', { simple: true })).toBe('wal');
      first.close();

      const second = openDatabase(path);
      expect(appliedMigrations(second)).toHaveLength(migrations.length);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('enforces the CHECK constraints that mirror the schema', () => {
    const db = openDatabase(':memory:');
    insertUser(db, 'u1');
    const insert = db.prepare(
      `INSERT INTO transactions (id, user_id, account, type, amount_cents, date, description, created_at, updated_at)
       VALUES ('t1', 'u1', ?, ?, ?, '2026-01-01', 'x', 'now', 'now')`,
    );

    expect(() => insert.run('checking', 'income', 100)).toThrow(/CHECK/);
    expect(() => insert.run('main', 'gift', 100)).toThrow(/CHECK/);
    expect(() => insert.run('main', 'income', 0)).toThrow(/CHECK/);
    expect(() => insert.run('main', 'income', 100)).not.toThrow();
    db.close();
  });

  it('rejects a transaction tagged with an unknown project', () => {
    const db = openDatabase();
    insertUser(db, 'u1');

    expect(() => insertTransaction(db, 't1', 'u1', 'nope')).toThrow(/FOREIGN KEY/);
    db.close();
  });

  it("rejects a transaction tagged with another user's project", () => {
    const db = openDatabase();
    insertUser(db, 'a');
    insertUser(db, 'b');
    insertProject(db, 'p-of-a', 'a');

    expect(() => insertTransaction(db, 't1', 'b', 'p-of-a')).toThrow(/FOREIGN KEY/);
    expect(() => insertTransaction(db, 't1', 'a', 'p-of-a')).not.toThrow();
    db.close();
  });

  it('keeps project names unique per user, not across users', () => {
    const db = openDatabase();
    insertUser(db, 'a');
    insertUser(db, 'b');
    insertProject(db, 'p1', 'a', 'holiday');

    expect(() => insertProject(db, 'p2', 'b', 'holiday')).not.toThrow();
    expect(() => insertProject(db, 'p3', 'a', 'holiday')).toThrow(/UNIQUE/);
    db.close();
  });

  it('stores emails only normalised and only once', () => {
    const db = openDatabase();
    insertUser(db, 'a', 'a@example.com');

    expect(() => insertUser(db, 'b', 'a@example.com')).toThrow(/UNIQUE/);
    expect(() => insertUser(db, 'c', 'A@example.com')).toThrow(/CHECK/);
    expect(() => insertUser(db, 'd', ' d@example.com')).toThrow(/CHECK/);
    db.close();
  });

  it('deletes the sessions of a deleted user', () => {
    const db = openDatabase();
    insertUser(db, 'a');
    db.prepare(
      `INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at)
       VALUES (?, 'a', 'now', 'now', 'later')`,
    ).run('f'.repeat(64));

    db.prepare("DELETE FROM users WHERE id = 'a'").run();

    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });
    db.close();
  });
});

describe('retryWhileLocked', () => {
  const busy = () => new Sqlite.SqliteError('database is locked', 'SQLITE_BUSY');

  it('retries while the database is locked and returns the result', () => {
    let calls = 0;
    const result = retryWhileLocked(
      () => {
        calls++;
        if (calls < 3) throw busy();
        return 'wal';
      },
      5,
      1,
    );

    expect(result).toBe('wal');
    expect(calls).toBe(3);
  });

  it('gives up after the last attempt', () => {
    expect(() =>
      retryWhileLocked(
        () => {
          throw busy();
        },
        2,
        1,
      ),
    ).toThrow('database is locked');
  });

  it('does not retry other errors', () => {
    let calls = 0;
    expect(() =>
      retryWhileLocked(() => {
        calls++;
        throw new Error('disk full');
      }),
    ).toThrow('disk full');
    expect(calls).toBe(1);
  });
});
