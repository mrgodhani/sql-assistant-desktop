import { databaseService } from '../services/database.service'
import { settingsService } from '../services/settings.service'
import { handleValidated, assertString } from '../lib/ipc-validator'
import { detectDestructiveStatements } from '../lib/sql-safety'
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

function executeWithTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${label} timed out after ${QUERY_TIMEOUT_MS / 1000}s`)),
      QUERY_TIMEOUT_MS
    )
  )
  return Promise.race([promise, timeout])
}

export function registerDatabaseIpc(): void {
  handleValidated(
    'db:execute',
    (connectionId, sql) => ({
      connectionId: assertString(connectionId, 'connectionId'),
      sql: assertString(sql, 'sql')
    }),
    async ({ connectionId, sql }): Promise<ExecutionResult> => {
      if (!databaseService.isConnected(connectionId))
        return { success: false, error: 'Connection lost. Please reconnect.' }

      const safeMode = await settingsService.get('safeMode')
      if (safeMode === 'true') {
        const detected = detectDestructiveStatements(sql)
        if (detected.length > 0) {
          return { success: false, requiresConfirmation: true, detectedStatements: detected }
        }
      }

      try {
        const result = await executeWithTimeout(
          databaseService.executeQuery(connectionId, sql),
          'Query execution'
        )
        return { success: true, result }
      } catch (error) {
        return { success: false, error: sanitizeQueryError(error) }
      }
    }
  )

  handleValidated(
    'db:executeConfirmed',
    (connectionId, sql) => ({
      connectionId: assertString(connectionId, 'connectionId'),
      sql: assertString(sql, 'sql')
    }),
    async ({ connectionId, sql }): Promise<ExecutionResult> => {
      if (!databaseService.isConnected(connectionId))
        return { success: false, error: 'Connection lost. Please reconnect.' }

      try {
        const result = await executeWithTimeout(
          databaseService.executeQuery(connectionId, sql),
          'Query execution'
        )
        return { success: true, result }
      } catch (error) {
        return { success: false, error: sanitizeQueryError(error) }
      }
    }
  )

  handleValidated(
    'db:validateSql',
    (connectionId, sql) => ({
      connectionId: assertString(connectionId, 'connectionId'),
      sql: assertString(sql, 'sql')
    }),
    async ({ connectionId, sql }): Promise<SqlValidationResult> => {
      if (!databaseService.isConnected(connectionId))
        return { valid: false, error: 'Connection lost. Please reconnect.' }

      try {
        return await executeWithTimeout(
          databaseService.validateSql(connectionId, sql),
          'Validation'
        )
      } catch (error) {
        return { valid: false, error: sanitizeQueryError(error) }
      }
    }
  )
}
