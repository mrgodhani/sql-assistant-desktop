import { randomUUID } from 'crypto'
import { desc, eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db'
import type {
  Conversation,
  ConversationSummary,
  ChatMessage
} from '../../shared/types'

const MAX_CONTENT_LENGTH = 65_536

export class ConversationService {
  list(): ConversationSummary[] {
    const db = getDatabase()
    const rows = db
      .select({
        id: schema.conversations.id,
        title: schema.conversations.title,
        connectionId: schema.conversations.connectionId,
        updatedAt: schema.conversations.updatedAt
      })
      .from(schema.conversations)
      .orderBy(desc(schema.conversations.updatedAt))
      .all()

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      connectionId: r.connectionId,
      updatedAt: r.updatedAt
    }))
  }

  get(id: string): Conversation | null {
    const db = getDatabase()
    const convRow = db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, id))
      .get()

    if (!convRow) return null

    const msgRows = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, id))
      .orderBy(schema.messages.createdAt)
      .all()

    const messages: ChatMessage[] = msgRows.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    }))

    return {
      id: convRow.id,
      title: convRow.title,
      connectionId: convRow.connectionId,
      messages,
      createdAt: convRow.createdAt,
      updatedAt: convRow.updatedAt
    }
  }

  create(connectionId: string | null = null): Conversation {
    const db = getDatabase()
    const id = randomUUID()
    const now = new Date().toISOString()

    db.insert(schema.conversations)
      .values({
        id,
        connectionId,
        title: 'New Chat',
        createdAt: now,
        updatedAt: now
      })
      .run()

    const created = this.get(id)
    if (!created) throw new Error('Failed to create conversation')
    return created
  }

  updateTitle(id: string, title: string): void {
    const trimmed = title.trim().slice(0, 200) || 'New Chat'
    const db = getDatabase()
    db.update(schema.conversations)
      .set({ title: trimmed, updatedAt: new Date().toISOString() })
      .where(eq(schema.conversations.id, id))
      .run()
  }

  delete(id: string): void {
    const db = getDatabase()
    const msgIds = db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, id))
      .all()

    for (const { id: msgId } of msgIds) {
      db.delete(schema.generatedQueries).where(eq(schema.generatedQueries.messageId, msgId)).run()
    }
    db.delete(schema.messages).where(eq(schema.messages.conversationId, id)).run()
    db.delete(schema.conversations).where(eq(schema.conversations.id, id)).run()
  }

  addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string): string {
    if (!content || content.length > MAX_CONTENT_LENGTH) {
      throw new Error('Invalid message content')
    }

    const db = getDatabase()
    const messageId = randomUUID()
    const now = new Date().toISOString()

    db.insert(schema.messages)
      .values({
        id: messageId,
        conversationId,
        role,
        content,
        createdAt: now
      })
      .run()

    db.update(schema.conversations)
      .set({ updatedAt: now })
      .where(eq(schema.conversations.id, conversationId))
      .run()

    return messageId
  }

  addGeneratedQuery(
    messageId: string,
    sql: string,
    metadata?: { executed?: boolean; executionTimeMs?: number; rowCount?: number; error?: string }
  ): void {
    const db = getDatabase()
    const id = randomUUID()
    const now = new Date().toISOString()

    db.insert(schema.generatedQueries)
      .values({
        id,
        messageId,
        sql: sql.slice(0, MAX_CONTENT_LENGTH),
        executed: metadata?.executed ?? false,
        executionTimeMs: metadata?.executionTimeMs ?? null,
        rowCount: metadata?.rowCount ?? null,
        error: metadata?.error ?? null,
        executedAt: metadata?.executed ? now : null
      })
      .run()
  }
}

export const conversationService = new ConversationService()
