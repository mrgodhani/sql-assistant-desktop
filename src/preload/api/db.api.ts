import { ipcRenderer } from 'electron'
import type { ExecutionResult } from '../../shared/types'

export const dbApi = {
  execute: (connectionId: string, sql: string): Promise<ExecutionResult> =>
    ipcRenderer.invoke('db:execute', connectionId, sql)
}
