import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'substack-rater.sqlite');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    fs.mkdirSync(dataDir, { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    migrate(db);
  }

  return db;
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL UNIQUE,
      feed_url TEXT NOT NULL,
      is_premium INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      last_sync_at TEXT,
      last_sync_status TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      guid TEXT,
      author TEXT,
      published_at TEXT,
      summary TEXT,
      content_text TEXT,
      source TEXT NOT NULL,
      is_premium_preview INTEGER NOT NULL DEFAULT 0,
      needs_full_text INTEGER NOT NULL DEFAULT 0,
      access_level TEXT NOT NULL DEFAULT 'unknown',
      full_text_status TEXT NOT NULL DEFAULT 'complete',
      detection_evidence TEXT,
      gmail_message_id TEXT UNIQUE,
      email_sender TEXT,
      email_labels TEXT,
      quality_score REAL NOT NULL DEFAULT 0,
      relevance_score REAL NOT NULL DEFAULT 0,
      importance_score REAL NOT NULL DEFAULT 0,
      ranking_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS articles_publication_id_idx ON articles(publication_id);
    CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles(published_at);
    CREATE INDEX IF NOT EXISTS articles_importance_idx ON articles(importance_score);
    CREATE TABLE IF NOT EXISTS email_senders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
      trust_status TEXT NOT NULL DEFAULT 'pending',
      last_imported_at TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS email_senders_trust_status_idx ON email_senders(trust_status);

    CREATE TABLE IF NOT EXISTS ignored_gmail_messages (
      message_id TEXT PRIMARY KEY,
      sender_email TEXT,
      subject TEXT,
      reason TEXT,
      ignored_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
      claim_text TEXT NOT NULL,
      claim_type TEXT NOT NULL,
      ticker TEXT,
      time_horizon TEXT,
      due_date TEXT,
      confidence TEXT,
      evidence TEXT,
      source_snippet TEXT,
      status TEXT NOT NULL DEFAULT 'unresolved',
      outcome_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS claims_article_id_idx ON claims(article_id);
    CREATE INDEX IF NOT EXISTS claims_publication_id_idx ON claims(publication_id);
    CREATE INDEX IF NOT EXISTS claims_status_idx ON claims(status);
  `);

  addColumnIfMissing(database, 'articles', 'access_level', "TEXT NOT NULL DEFAULT 'unknown'");
  addColumnIfMissing(database, 'articles', 'full_text_status', "TEXT NOT NULL DEFAULT 'complete'");
  addColumnIfMissing(database, 'articles', 'detection_evidence', 'TEXT');
  addColumnIfMissing(database, 'articles', 'gmail_message_id', 'TEXT');
  addColumnIfMissing(database, 'articles', 'email_sender', 'TEXT');
  addColumnIfMissing(database, 'articles', 'email_labels', 'TEXT');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS articles_gmail_message_id_unique_idx ON articles(gmail_message_id);');
  database.exec('CREATE INDEX IF NOT EXISTS articles_email_sender_idx ON articles(email_sender);');
}

function addColumnIfMissing(database: DatabaseSync, table: string, column: string, definition: string) {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!rows.some((row) => row.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function closeDb() {
  db?.close();
  db = null;
}
