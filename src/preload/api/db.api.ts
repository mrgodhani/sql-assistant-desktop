import { ipcRenderer } from 'electron'
import type { ExecutionResult, SqlValidationResult } from '../../shared/types'

export const dbApi = {
  execute: (connectionId: string, sql: string): Promise<ExecutionResult> =>
    ipcRenderer.invoke('db:execute', connectionId, sql),
  executeConfirmed: (connectionId: string, sql: string): Promise<ExecutionResult> =>
    ipcRenderer.invoke('db:executeConfirmed', connectionId, sql),
  validateSql: (connectionId: string, sql: string): Promise<SqlValidationResult> =>
    ipcRenderer.invoke('db:validateSql', connectionId, sql)
}
