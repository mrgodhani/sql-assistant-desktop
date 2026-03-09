import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['postgresql', 'mysql', 'sqlite', 'sqlserver'] }).notNull(),
  host: text('host'),
  port: integer('port'),
  database: text('database').notNull(),
  username: text('username'),
  passwordEncrypted: text('password_encrypted'),
  connectionStringEncrypted: text('connection_string_encrypted'),
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).default(false),
  filePath: text('file_path'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
})

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id').references(() => connections.id),
    title: text('title').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  },
  (table) => [
    index('idx_conversations_connection').on(table.connectionId),
    index('idx_conversations_updated').on(table.updatedAt)
  ]
)

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString())
  },
  (table) => [index('idx_messages_conversation').on(table.conversationId, table.createdAt)]
)

export const generatedQueries = sqliteTable(
  'generated_queries',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id),
    sql: text('sql').notNull(),
    executed: integer('executed', { mode: 'boolean' }).default(false),
    executionTimeMs: integer('execution_time_ms'),
    rowCount: integer('row_count'),
    error: text('error'),
    executedAt: text('executed_at')
  },
  (table) => [index('idx_queries_message').on(table.messageId)]
)

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  encrypted: integer('encrypted', { mode: 'boolean' }).default(false),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
})
