import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { databaseService } from '../services/database.service'
import { schemaService } from '../services/schema.service'
import { handleValidated, assertString } from '../lib/ipc-validator'
import type { ConnectionConfig } from '../../shared/types'

export function registerConnectionsIpc(): void {
  ipcMain.handle('connections:list', async () => {
    return databaseService.listConnections()
  })

  handleValidated(
    'connections:get',
    (id) => assertString(id, 'id'),
    async (id) => databaseService.getConnection(id)
  )

  ipcMain.handle('connections:create', async (_event, config: ConnectionConfig) => {
    return databaseService.createConnection(config)
  })

  handleValidated(
    'connections:update',
    (id, config) => ({ id: assertString(id, 'id'), config: config as ConnectionConfig }),
    async ({ id, config }) => databaseService.updateConnection(id, config)
  )

  handleValidated(
    'connections:delete',
    (id) => assertString(id, 'id'),
    async (id) => {
      await databaseService.deleteConnection(id)
    }
  )

  handleValidated(
    'connections:connect',
    (id) => assertString(id, 'id'),
    async (id) => {
      const result = await databaseService.connect(id)
      if (result.success) {
        schemaService.introspect(id).catch((err) => {
          log.error(
            '[Schema] Background introspection failed:',
            err instanceof Error ? err.message : err
          )
        })
      }
      return result
    }
  )

  handleValidated(
    'connections:disconnect',
    (id) => assertString(id, 'id'),
    async (id) => {
      schemaService.clearCache(id)
      await databaseService.disconnect(id)
    }
  )

  ipcMain.handle('connections:test', async (_event, config: ConnectionConfig) => {
    return databaseService.testConnection(config)
  })

  ipcMain.handle('connections:pickSqliteFile', async () => {
    return databaseService.pickSqliteFile()
  })
}
