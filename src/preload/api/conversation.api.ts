import { ipcRenderer } from 'electron'
import type { Conversation, ConversationSummary } from '../../shared/types'

export const conversationApi = {
  list: (): Promise<ConversationSummary[]> => ipcRenderer.invoke('conversation:list'),

  get: (id: string): Promise<Conversation | null> => ipcRenderer.invoke('conversation:get', id),

  create: (connectionId?: string | null): Promise<Conversation> =>
    ipcRenderer.invoke('conversation:create', connectionId),

  updateTitle: (id: string, title: string): Promise<void> =>
    ipcRenderer.invoke('conversation:updateTitle', id, title),

  delete: (id: string): Promise<void> => ipcRenderer.invoke('conversation:delete', id),

  truncate: (conversationId: string, fromIndex: number): Promise<void> =>
    ipcRenderer.invoke('conversation:truncate', conversationId, fromIndex),

  addMessage: (
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<string> =>
    ipcRenderer.invoke('conversation:addMessage', conversationId, role, content),

  addGeneratedQuery: (
    messageId: string,
    sql: string,
    metadata?: { executed?: boolean; executionTimeMs?: number; rowCount?: number; error?: string }
  ): Promise<void> => ipcRenderer.invoke('conversation:addGeneratedQuery', messageId, sql, metadata)
}
