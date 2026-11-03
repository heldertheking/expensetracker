import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCore } from './app.js';
import { defaultDatabasePath, openDatabase } from './db/database.js';
import { generateSeedData } from './seed/data.js';
import { seedDatabase } from './seed/seed.js';

/** `npm run seed -w apps/api`: fills an empty database (`DB_PATH`) with demo data. */
const DB_PATH = process.env.DB_PATH || defaultDatabasePath();

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = openDatabase(DB_PATH);
try {
  const counts = seedDatabase(createCore({ db }), generateSeedData(new Date()));
  console.log(
    `Seeded ${DB_PATH}: ${counts.projects} projects, ${counts.transactions} transactions`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
