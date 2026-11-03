import type { Migration } from '../migrate.js';

/**
 * Server-side sessions. Only the SHA-256 of the session token is stored (64 hex characters), so
 * the table holds nothing a client could present. A session ends at `expires_at` (absolute) or
 * when it has been idle too long since `last_seen_at`; deleting the user deletes its sessions.
 */
const migration: Migration = {
  version: 5,
  name: 'create-sessions',
  up: `
    CREATE TABLE sessions (
      token_hash   TEXT NOT NULL PRIMARY KEY CHECK (length(token_hash) = 64),
      user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at   TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at   TEXT NOT NULL
    );
    CREATE INDEX sessions_user_id ON sessions (user_id);
    CREATE INDEX sessions_expires_at ON sessions (expires_at);
  `,
};

export default migration;
