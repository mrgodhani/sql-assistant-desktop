import { sql } from 'drizzle-orm'
import { getDatabase } from './index'

export function createMigrationTables(): void {
  const db = getDatabase()

  db.run(sql`CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('postgresql', 'mysql', 'sqlite', 'sqlserver')),
    host TEXT,
    port INTEGER,
    database TEXT NOT NULL,
    username TEXT,
    password_encrypted TEXT,
    connection_string_encrypted TEXT,
    ssl_enabled INTEGER DEFAULT 0,
    file_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(sql`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    connection_id TEXT REFERENCES connections(id),
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(sql`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(sql`CREATE TABLE IF NOT EXISTS generated_queries (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    sql TEXT NOT NULL,
    executed INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    row_count INTEGER,
    error TEXT,
    executed_at TEXT
  )`)

  db.run(sql`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    encrypted INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_conversations_connection ON conversations(connection_id)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_queries_message ON generated_queries(message_id)`)
}
