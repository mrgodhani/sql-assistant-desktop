import { ipcMain } from 'electron'
import { schemaService } from '../services/schema.service'

export function registerSchemaIpc(): void {
  ipcMain.handle('schema:introspect', async (_event, connectionId: string) => {
    if (!connectionId || typeof connectionId !== 'string') {
      return {
        success: false,
        error: 'Connection ID is required',
        tableCount: 0,
        introspectedAt: new Date().toISOString()
      }
    }
    return schemaService.introspect(connectionId)
  })

  ipcMain.handle('schema:refresh', async (_event, connectionId: string) => {
    if (!connectionId || typeof connectionId !== 'string') {
      return {
        success: false,
        error: 'Connection ID is required',
        tableCount: 0,
        introspectedAt: new Date().toISOString()
      }
    }
    return schemaService.refresh(connectionId)
  })

  ipcMain.handle('schema:getContext', async (_event, connectionId: string) => {
    if (!connectionId || typeof connectionId !== 'string') return ''
    return schemaService.getSchemaContext(connectionId)
  })
}
