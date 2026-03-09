import { ipcMain } from 'electron'
import { databaseService } from '../services/database.service'
import type { ExecutionResult, SqlValidationResult } from '../../shared/types'

const QUERY_TIMEOUT_MS = 60_000

function sanitizeQueryError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (/syntax|parse|invalid sql/i.test(msg)) return 'Invalid SQL syntax. Check your query.'
  if (/permission|access denied|unauthorized/i.test(msg))
    return 'Permission denied. Check database user privileges.'
  if (/connection|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg))
    return 'Connection lost. Please reconnect.'
  if (/Validation timed out/i.test(msg)) return 'Validation timed out.'
  if (/timeout|timed out/i.test(msg))
    return 'Query timed out. Try a more specific query or add limits.'
  if (/Connection is not active/i.test(msg)) return 'Connection lost. Please reconnect.'
  return 'Query failed. Please check your SQL and try again.'
}

function executeWithTimeout<T>(
  promise: Promise<T>,
  label: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${label} timed out after ${QUERY_TIMEOUT_MS / 1000}s`)),
      QUERY_TIMEOUT_MS
    )
  )
  return Promise.race([promise, timeout])
}

export function registerDatabaseIpc(): void {
  ipcMain.handle('db:execute', async (_event, connectionId: unknown, sql: unknown): Promise<ExecutionResult> => {
    if (!connectionId || typeof connectionId !== 'string')
      return { success: false, error: 'Connection ID is required' }
    if (!sql || typeof sql !== 'string' || !String(sql).trim())
      return { success: false, error: 'SQL query is required' }
    if (!databaseService.isConnected(connectionId))
      return { success: false, error: 'Connection lost. Please reconnect.' }

    try {
      const result = await executeWithTimeout(
        databaseService.executeQuery(connectionId, String(sql).trim()),
        'Query execution'
      )
      return { success: true, result }
    } catch (error) {
      return { success: false, error: sanitizeQueryError(error) }
    }
  })

  ipcMain.handle(
    'db:validateSql',
    async (_event, connectionId: unknown, sql: unknown): Promise<SqlValidationResult> => {
      if (!connectionId || typeof connectionId !== 'string')
        return { valid: false, error: 'Connection ID is required' }
      if (!sql || typeof sql !== 'string' || !String(sql).trim())
        return { valid: false, error: 'SQL query is required' }
      if (!databaseService.isConnected(connectionId))
        return { valid: false, error: 'Connection lost. Please reconnect.' }

      try {
        return await executeWithTimeout(
          databaseService.validateSql(connectionId, String(sql).trim()),
          'Validation'
        )
      } catch (error) {
        return { valid: false, error: sanitizeQueryError(error) }
      }
    }
  )
}
