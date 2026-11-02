import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const source = resolve(process.env.DATABASE_PATH || './data/realm.sqlite');
const destination = resolve(process.argv[2] || `./backups/realm-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
if (!existsSync(source)) throw new Error('Database not found. Start Realm and create an account first.');
if (source === destination || existsSync(destination)) throw new Error('Choose a new backup filename. Existing files will not be overwritten.');
mkdirSync(dirname(destination), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  console.log(`SQLite backup saved: ${destination}`);
} finally { db.close(); }
