import { ipcRenderer } from 'electron'
import type {
  DatabaseConnection,
  ConnectionConfig,
  ConnectionTestResult,
  ConnectionResult
} from '../../shared/types'

export const connectionsApi = {
  list: (): Promise<DatabaseConnection[]> => ipcRenderer.invoke('connections:list'),

  get: (id: string): Promise<DatabaseConnection | null> =>
    ipcRenderer.invoke('connections:get', id),

  create: (config: ConnectionConfig): Promise<DatabaseConnection> =>
    ipcRenderer.invoke('connections:create', config),

  update: (id: string, config: ConnectionConfig): Promise<DatabaseConnection> =>
    ipcRenderer.invoke('connections:update', id, config),

  delete: (id: string): Promise<void> => ipcRenderer.invoke('connections:delete', id),

  connect: (id: string): Promise<ConnectionResult> => ipcRenderer.invoke('connections:connect', id),

  disconnect: (id: string): Promise<void> => ipcRenderer.invoke('connections:disconnect', id),

  test: (config: ConnectionConfig): Promise<ConnectionTestResult> =>
    ipcRenderer.invoke('connections:test', config),

  pickSqliteFile: (): Promise<string | null> => ipcRenderer.invoke('connections:pickSqliteFile')
}
