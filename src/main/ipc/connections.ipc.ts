import { ipcMain } from 'electron'
import { databaseService } from '../services/database.service'
import { schemaService } from '../services/schema.service'
import type { ConnectionConfig } from '../../shared/types'

export function registerConnectionsIpc(): void {
  ipcMain.handle('connections:list', async () => {
    return databaseService.listConnections()
  })

  ipcMain.handle('connections:get', async (_event, id: string) => {
    return databaseService.getConnection(id)
  })

  ipcMain.handle('connections:create', async (_event, config: ConnectionConfig) => {
    return databaseService.createConnection(config)
  })

  ipcMain.handle('connections:update', async (_event, id: string, config: ConnectionConfig) => {
    return databaseService.updateConnection(id, config)
  })

  ipcMain.handle('connections:delete', async (_event, id: string) => {
    await databaseService.deleteConnection(id)
  })

  ipcMain.handle('connections:connect', async (_event, id: string) => {
    const result = await databaseService.connect(id)
    if (result.success) {
      schemaService.introspect(id).catch((err) => {
        console.error('[Schema] Background introspection failed:', err instanceof Error ? err.message : err)
      })
    }
    return result
  })

  ipcMain.handle('connections:disconnect', async (_event, id: string) => {
    schemaService.clearCache(id)
    await databaseService.disconnect(id)
  })

  ipcMain.handle('connections:test', async (_event, config: ConnectionConfig) => {
    return databaseService.testConnection(config)
  })

  ipcMain.handle('connections:pickSqliteFile', async () => {
    return databaseService.pickSqliteFile()
  })
}
