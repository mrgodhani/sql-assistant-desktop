import { schemaService } from '../services/schema.service'
import { searchSchema } from '../lib/schema-search'
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

  handleValidated(
    'schema:search',
    (connectionId, query) => ({
      connectionId: assertString(connectionId, 'connectionId'),
      query: typeof query === 'string' ? query : ''
    }),
    async ({ connectionId, query }) => {
      let schema = schemaService.getCachedSchema(connectionId)
      if (!schema) {
        const result = await schemaService.introspect(connectionId)
        schema = result.schema ?? null
      }
      if (!schema) return []
      return searchSchema(schema, query).slice(0, 100)
    }
  )
}
