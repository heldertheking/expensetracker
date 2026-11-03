import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCore } from './app.js';
import { defaultDatabasePath, openDatabase } from './db/database.js';
import { DEMO_USER, generateSeedData, SECOND_DEMO_USER } from './seed/data.js';
import { seedDatabase } from './seed/seed.js';

/** `npm run seed -w apps/api`: fills an empty database (`DB_PATH`) with demo users and data. */
const DB_PATH = process.env.DB_PATH || defaultDatabasePath();

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = openDatabase(DB_PATH);
try {
  const counts = await seedDatabase(createCore({ db }), generateSeedData(new Date()));
  console.log(
    `Seeded ${DB_PATH}: ${counts.users.length} users, ${counts.projects} primary projects, ${counts.transactions} primary transactions`,
  );
  console.log(`  Demo user 1: ${DEMO_USER.email} / ${DEMO_USER.password}`);
  console.log(`  Demo user 2: ${SECOND_DEMO_USER.email} / ${SECOND_DEMO_USER.password}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
