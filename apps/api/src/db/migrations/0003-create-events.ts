import type { Migration } from '../migrate.js';

/** Append-only log of business events. `sequence` gives the order and is never reused. */
const migration: Migration = {
  version: 3,
  name: 'create-events',
  up: `
    CREATE TABLE events (
      sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
      id          TEXT    NOT NULL UNIQUE,
      type        TEXT    NOT NULL,
      occurred_at TEXT    NOT NULL,
      payload     TEXT    NOT NULL CHECK (json_valid(payload))
    );
    CREATE INDEX events_type ON events (type);
  `,
};

export default migration;
