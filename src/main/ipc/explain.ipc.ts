import { runExplain } from '../services/explain.service'
import { handleValidated, assertString } from '../lib/ipc-validator'

export function registerExplainIpc(): void {
  handleValidated(
    'explain:run',
    (connectionId, sql) => ({
      connectionId: assertString(connectionId, 'connectionId'),
      sql: typeof sql === 'string' ? sql : ''
    }),
    async ({ connectionId, sql }) => runExplain(connectionId, sql)
  )
}
