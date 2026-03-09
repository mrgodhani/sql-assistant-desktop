import { schemaService } from '../services/schema.service'
import { handleValidated, assertString } from '../lib/ipc-validator'

export function registerSchemaIpc(): void {
  handleValidated(
    'schema:introspect',
    (connectionId) => assertString(connectionId, 'connectionId'),
    async (connectionId) => schemaService.introspect(connectionId)
  )

  handleValidated(
    'schema:refresh',
    (connectionId) => assertString(connectionId, 'connectionId'),
    async (connectionId) => schemaService.refresh(connectionId)
  )

  handleValidated(
    'schema:getContext',
    (connectionId) => assertString(connectionId, 'connectionId'),
    async (connectionId) => schemaService.getSchemaContext(connectionId)
  )
}
