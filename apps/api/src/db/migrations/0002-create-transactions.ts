import type { Migration } from '../migrate.js';

const migration: Migration = {
  version: 2,
  name: 'create-transactions',
  up: `
    CREATE TABLE transactions (
      id           TEXT    PRIMARY KEY,
      account      TEXT    NOT NULL CHECK (account IN ('main', 'savings')),
      type         TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      date         TEXT    NOT NULL,
      description  TEXT    NOT NULL,
      project_id   TEXT    REFERENCES projects (id),
      created_at   TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );
    CREATE INDEX transactions_date ON transactions (date);
    CREATE INDEX transactions_account ON transactions (account);
    CREATE INDEX transactions_project_id ON transactions (project_id);
  `,
};

export default migration;
