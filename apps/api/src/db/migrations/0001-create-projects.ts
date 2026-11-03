import type { Migration } from '../migrate.js';

/** Project names are unique regardless of case, so "Holiday" and "holiday" cannot both exist. */
const migration: Migration = {
  version: 1,
  name: 'create-projects',
  up: `
    CREATE TABLE projects (
      id           TEXT    PRIMARY KEY,
      name         TEXT    NOT NULL,
      description  TEXT    NOT NULL DEFAULT '',
      budget_cents INTEGER CHECK (budget_cents IS NULL OR budget_cents > 0),
      created_at   TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );
    CREATE UNIQUE INDEX projects_name_unique ON projects (name COLLATE NOCASE);
  `,
};

export default migration;
