import { ipcMain } from 'electron'
import { conversationService } from '../services/conversation.service'

export function registerConversationIpc(): void {
  ipcMain.handle('conversation:list', async () => {
    return conversationService.list()
  })

  ipcMain.handle('conversation:get', async (_event, id: string) => {
    if (!id || typeof id !== 'string') return null
    return conversationService.get(id)
  })

  ipcMain.handle('conversation:create', async (_event, connectionId?: string | null) => {
    const conn = connectionId == null || connectionId === '' ? null : connectionId
    return conversationService.create(conn)
  })

  ipcMain.handle(
    'conversation:updateTitle',
    async (_event, id: string, title: string) => {
      if (!id || typeof id !== 'string') return
      conversationService.updateTitle(id, title ?? 'New Chat')
    }
  )

  ipcMain.handle('conversation:delete', async (_event, id: string) => {
    if (!id || typeof id !== 'string') return
    conversationService.delete(id)
  })

  ipcMain.handle(
    'conversation:addMessage',
    async (_event, conversationId: string, role: string, content: string) => {
      if (!conversationId || typeof conversationId !== 'string') {
        throw new Error('conversationId is required')
      }
      const validRole = ['user', 'assistant', 'system'].includes(role) ? role : 'user'
      if (!content || typeof content !== 'string') {
        throw new Error('content is required')
      }
      return conversationService.addMessage(conversationId, validRole as 'user' | 'assistant' | 'system', content)
    }
  )

  ipcMain.handle(
    'conversation:addGeneratedQuery',
    async (
      _event,
      messageId: string,
      sql: string,
      metadata?: { executed?: boolean; executionTimeMs?: number; rowCount?: number; error?: string }
    ) => {
      if (!messageId || typeof messageId !== 'string') {
        throw new Error('messageId is required')
      }
      if (!sql || typeof sql !== 'string') {
        throw new Error('sql is required')
      }
      conversationService.addGeneratedQuery(messageId, sql, metadata)
    }
  )
}
