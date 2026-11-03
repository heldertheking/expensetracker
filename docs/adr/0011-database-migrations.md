# 0011. Versioned, forward-only database migrations

- Status: accepted
- Date: 2026-11-03

## Context

The API stores its data in SQLite (better-sqlite3). Tables will change as the project grows, and the same schema must be created identically in the developer's file database, in CI and in the in-memory databases of the integration tests. Ad-hoc `CREATE TABLE IF NOT EXISTS` at startup cannot change an existing table and leaves no record of what was applied.

## Decision

Every table is created and changed **only through migrations**.

- A migration is a TypeScript module in `apps/api/src/db/migrations/` named `NNNN-short-name.ts`, exporting `{ version, name, up }` where `up` is the SQL to run. Modules (not `.sql` files) so `tsc` builds them without a copy step.
- All migrations are listed in order in `migrations/index.ts`. Versions are consecutive integers starting at 1.
- A small runner (`db/migrate.ts`) creates `schema_migrations (version, name, applied_at)`, then applies every pending migration in ascending order, each in its own transaction together with its `schema_migrations` row. It runs whenever a database is opened (server start and every test database).
- Migrations are **forward-only and immutable**: an applied migration is never edited or deleted; a change is a new migration. There are no down migrations.
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`), money columns are `INTEGER` cents with `CHECK` constraints that mirror the schema package.

## Options considered

- `CREATE TABLE IF NOT EXISTS` at startup: cannot evolve a table.
- A migration library (Knex, umzug, node-pg-migrate): more features than needed and one more dependency to keep under `allowScripts` and `npm audit`; the runner is about 40 lines and fully tested.
- `PRAGMA user_version` instead of a table: works, but records neither names nor dates.
- Down migrations: rarely correct for data and never exercised; restoring a backup is the rollback.

## Consequences

- Tests and production run the same SQL, so integration tests cover the real schema.
- The runner itself has tests: fresh database, re-run is a no-op, partial failure rolls back.
- Changing a column means writing a new migration, which SQLite sometimes makes verbose (table rebuild).
