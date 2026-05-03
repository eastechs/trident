import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { drizzle } from 'drizzle-orm/pglite';
import { app } from 'electron';
import path from 'path';
import * as schema from './db/schema.js';
import { runMigrations } from './db/migrations.js';

let db: ReturnType<typeof drizzle<typeof schema>>;
let pglite: PGlite;

export async function initDatabase() {
  const dataDir = path.join(app.getPath('userData'), 'pglite');

  pglite = new PGlite(dataDir, { extensions: { vector } });
  db = drizzle(pglite, { schema });

  await runMigrations(pglite);

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}
