import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id         INTEGER PRIMARY KEY,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS document_shares (
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (document_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
  CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
`;

export const DEMO_PASSWORD = 'demo1234';

const DEMO_USERS = [
  { email: 'alice@ajaia.test', name: 'Alice Johnson' },
  { email: 'bob@ajaia.test', name: 'Bob Martinez' },
  { email: 'carol@ajaia.test', name: 'Carol Chen' },
];

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function openDatabase(file = ':memory:') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

function seed(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return;

  const insertUser = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');
  const ids = DEMO_USERS.map((u) => insertUser.run(u.email, u.name, hashPassword(DEMO_PASSWORD)).lastInsertRowid);

  // One sample doc owned by Alice and shared with Bob, so the sharing flow is
  // visible right after the first login.
  const docId = db
    .prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)')
    .run(
      ids[0],
      'Q3 planning notes',
      '<h1>Q3 planning notes</h1><p>Shared with <strong>Bob</strong> as an editor.</p>' +
        '<h2>Goals</h2><ul><li><p>Ship the editor MVP</p></li><li><p>Collect feedback from two teams</p></li></ul>'
    ).lastInsertRowid;
  db.prepare("INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, 'editor')").run(docId, ids[1]);
}
