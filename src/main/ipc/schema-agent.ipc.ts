import { ipcMain, BrowserWindow } from 'electron'
import { schemaAgentService } from '../services/schema-agent.service'
import type { SchemaAgentChatParams, DatabaseType } from '../../shared/types'

export function registerSchemaAgentIpc(): void {
  ipcMain.handle(
    'schema-agent:create-session',
    async (_event, dialect: DatabaseType, connectionId?: string) => {
      return schemaAgentService.createSession(dialect, connectionId)
    }
  )

  ipcMain.handle('schema-agent:chat', async (event, params: SchemaAgentChatParams) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { error: 'Window not found' }

    schemaAgentService
      .chat(params, (chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('schema-agent:stream-chunk', chunk)
        }
      })
      .catch((err) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('schema-agent:stream-chunk', {
            sessionId: params.sessionId,
            type: 'error',
            error: err instanceof Error ? err.message : 'Agent error'
          })
        }
      })

    return { sessionId: params.sessionId }
  })

  ipcMain.handle('schema-agent:get-session', async (_event, sessionId: string) => {
    return schemaAgentService.getSession(sessionId) ?? null
  })

  ipcMain.handle('schema-agent:delete-session', async (_event, sessionId: string) => {
    schemaAgentService.deleteSession(sessionId)
  })

  ipcMain.handle(
    'schema-agent:resolve-approval',
    async (_event, sessionId: string, approved: boolean) => {
      schemaAgentService.resolveApproval(sessionId, approved)
    }
  )

  ipcMain.handle('schema-agent:undo', async (_event, sessionId: string) => {
    return schemaAgentService.undoSchema(sessionId)
  })

  ipcMain.on('schema-agent:cancel', (_event, sessionId: string) => {
    schemaAgentService.cancelRequest(sessionId)
  })
}
