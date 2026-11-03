import type { Migration } from '../migrate.js';

/**
 * Accounts. The email is stored normalised (trimmed, lowercased; the schema only accepts ASCII
 * addresses, so SQLite's `lower` agrees) and is unique. `password_hash` holds
 * `scrypt$N$r$p$salt$key`; it never leaves the repository.
 */
const migration: Migration = {
  version: 4,
  name: 'create-users',
  up: `
    CREATE TABLE users (
      id            TEXT NOT NULL PRIMARY KEY,
      email         TEXT NOT NULL CHECK (email = lower(trim(email)) AND length(email) <= 254),
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE UNIQUE INDEX users_email_unique ON users (email);
  `,
};

export default migration;
