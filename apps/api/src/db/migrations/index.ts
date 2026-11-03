import type { Migration } from '../migrate.js';
import createProjects from './0001-create-projects.js';
import createTransactions from './0002-create-transactions.js';
import createEvents from './0003-create-events.js';
import createUsers from './0004-create-users.js';
import createSessions from './0005-create-sessions.js';
import addUserOwnership from './0006-add-user-ownership.js';

/** Every migration, in order. Append new ones at the end; never edit or remove an applied one. */
const migrations: readonly Migration[] = [
  createProjects,
  createTransactions,
  createEvents,
  createUsers,
  createSessions,
  addUserOwnership,
];

export { migrations };
