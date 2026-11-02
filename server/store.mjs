import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', owner_id TEXT REFERENCES users(id),
      pair TEXT UNIQUE, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      room_id TEXT NOT NULL REFERENCES rooms(id), user_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY(room_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
      room_id TEXT NOT NULL REFERENCES rooms(id), user_id TEXT NOT NULL REFERENCES users(id),
      text TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_room ON messages(room_id, seq);
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS summaries (
      room_id TEXT PRIMARY KEY REFERENCES rooms(id), last_seq INTEGER NOT NULL,
      model TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO rooms(id,name,kind,description,created_at)
      VALUES('world','World chat','world','The meeting place for every adventurer. Say hello, find a party, make a friend.',0);
  `);
  const addColumn = (table, column, definition) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  addColumn('users', 'avatar', "TEXT NOT NULL DEFAULT 'knight'");
  addColumn('rooms', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('members', 'last_read', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('messages', 'client_id', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS message_retry ON messages(user_id,client_id) WHERE client_id IS NOT NULL');
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return { db, get, all, run, transaction };
}
