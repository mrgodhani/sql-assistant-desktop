import { ipcMain } from 'electron'
import { conversationService } from '../services/conversation.service'
import { handleValidated, assertString } from '../lib/ipc-validator'

export function registerConversationIpc(): void {
  ipcMain.handle('conversation:list', async () => {
    return conversationService.list()
  })

  handleValidated(
    'conversation:get',
    (id) => assertString(id, 'id'),
    async (id) => conversationService.get(id)
  )

  ipcMain.handle('conversation:create', async (_event, connectionId?: string | null) => {
    const conn = connectionId == null || connectionId === '' ? null : connectionId
    return conversationService.create(conn)
  })

  handleValidated(
    'conversation:updateTitle',
    (id, title) => ({
      id: assertString(id, 'id'),
      title: typeof title === 'string' && title.trim() ? title.trim() : 'New Chat'
    }),
    async ({ id, title }) => {
      conversationService.updateTitle(id, title)
    }
  )

  handleValidated(
    'conversation:delete',
    (id) => assertString(id, 'id'),
    async (id) => {
      conversationService.delete(id)
    }
  )

  handleValidated(
    'conversation:truncate',
    (conversationId, fromIndex) => ({
      conversationId: assertString(conversationId, 'conversationId'),
      fromIndex: typeof fromIndex === 'number' && fromIndex >= 0 ? fromIndex : 0
    }),
    async ({ conversationId, fromIndex }) => {
      conversationService.truncate(conversationId, fromIndex)
    }
  )

  handleValidated(
    'conversation:addMessage',
    (conversationId, role, content) => ({
      conversationId: assertString(conversationId, 'conversationId'),
      role: (['user', 'assistant', 'system'].includes(role as string) ? role : 'user') as
        | 'user'
        | 'assistant'
        | 'system',
      content: assertString(content, 'content')
    }),
    async ({ conversationId, role, content }) => {
      return conversationService.addMessage(conversationId, role, content)
    }
  )

  handleValidated(
    'conversation:addGeneratedQuery',
    (messageId, sql, metadata) => ({
      messageId: assertString(messageId, 'messageId'),
      sql: assertString(sql, 'sql'),
      metadata: metadata as
        | {
            executed?: boolean
            executionTimeMs?: number
            rowCount?: number
            error?: string
          }
        | undefined
    }),
    async ({ messageId, sql, metadata }) => {
      conversationService.addGeneratedQuery(messageId, sql, metadata)
    }
  )
}
