import type { Migration } from '../migrate.js';
import createProjects from './0001-create-projects.js';
import createTransactions from './0002-create-transactions.js';
import createEvents from './0003-create-events.js';

/** Every migration, in order. Append new ones at the end; never edit or remove an applied one. */
const migrations: readonly Migration[] = [createProjects, createTransactions, createEvents];

export { migrations };
