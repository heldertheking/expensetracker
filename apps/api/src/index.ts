import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { defaultDatabasePath, openDatabase } from './db/database.js';

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || defaultDatabasePath();

if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true });
const db = openDatabase(DB_PATH);

const app = createApp({
  db,
  subscribers: [(event) => console.log(`event #${event.sequence} ${event.type}`)],
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT} (database ${DB_PATH})`);
});
