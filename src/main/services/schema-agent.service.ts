import log from 'electron-log/main'
import type {
  SchemaDesign,
  SchemaAgentStreamChunk,
  SchemaAgentChatParams,
  SchemaDesignSession,
  SchemaAgentTool,
  DatabaseType
} from '../../shared/types'
import { DEFAULT_PROVIDER_CONFIGS } from '../../shared/types'
import { settingsService } from './settings.service'
import { schemaService } from './schema.service'
import { databaseService } from './database.service'
import { validateSchemaDesign, normalizeSchemaDesign } from '../lib/schema-validator'
import { databaseSchemaToDesign } from '../lib/schema-converter'
import { generateDDL } from './ddl-generator'
import {
  buildSchemaAgentSystemPrompt,
  getSchemaAgentToolDefinitions
} from './ai/schema-agent-prompt'
import { getAdapter } from './ai.service'
import type { ToolCallResponse } from './ai/types'

const MAX_AGENT_ITERATIONS = 10
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000

class SchemaAgentService {
  private sessions = new Map<string, SchemaDesignSession>()
  private conversations = new Map<
    string,
    Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }>
  >()
  private pendingApprovals = new Map<string, { resolve: (approved: boolean) => void }>()
  private activeRequests = new Map<string, AbortController>()

  createSession(dialect: DatabaseType, connectionId?: string): SchemaDesignSession {
    const id = crypto.randomUUID()
    const session: SchemaDesignSession = {
      id,
      dialect,
      connectionId,
      schema: null,
      history: []
    }
    this.sessions.set(id, session)
    this.conversations.set(id, [])
    return session
  }

  getSession(sessionId: string): SchemaDesignSession | undefined {
    return this.sessions.get(sessionId)
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.conversations.delete(sessionId)
    this.cancelRequest(sessionId)
  }

  async chat(
    params: SchemaAgentChatParams,
    sendChunk: (chunk: SchemaAgentStreamChunk) => void
  ): Promise<void> {
    const session = this.sessions.get(params.sessionId)
    if (!session) throw new Error('Session not found')

    const messages = this.conversations.get(params.sessionId)!
    messages.push({ role: 'user', content: params.message })

    const abortController = new AbortController()
    this.activeRequests.set(params.sessionId, abortController)

    try {
      await this.agentLoop(session, params, messages, sendChunk, abortController.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        log.error('[SchemaAgent] chat error:', err)
        sendChunk({
          sessionId: params.sessionId,
          type: 'error',
          error: err instanceof Error ? err.message : 'Agent error'
        })
      }
    } finally {
      this.activeRequests.delete(params.sessionId)
      sendChunk({ sessionId: params.sessionId, type: 'done' })
    }
  }

  private async agentLoop(
    session: SchemaDesignSession,
    params: SchemaAgentChatParams,
    messages: Array<{
      role: string
      content: string
      tool_call_id?: string
      tool_calls?: unknown[]
    }>,
    sendChunk: (chunk: SchemaAgentStreamChunk) => void,
    signal: AbortSignal
  ): Promise<void> {
    for (let i = 0; i < MAX_AGENT_ITERATIONS && !signal.aborted; i++) {
      const connectionName = session.connectionId
        ? (await databaseService.getConnection(session.connectionId))?.name
        : undefined

      const systemPrompt = buildSchemaAgentSystemPrompt(
        session.dialect,
        session.schema,
        connectionName
      )

      const config = await settingsService.getProviderConfig(params.provider)
      const apiKey = config.apiKey ?? ''
      const baseUrl = config.baseUrl ?? DEFAULT_PROVIDER_CONFIGS[params.provider].baseUrl ?? ''

      if (params.provider !== 'ollama' && !apiKey) {
        sendChunk({
          sessionId: params.sessionId,
          type: 'error',
          error: `No API key configured for ${params.provider}`
        })
        return
      }

      const adapter = getAdapter(params.provider)
      if (!adapter.chatWithTools) {
        sendChunk({
          sessionId: params.sessionId,
          type: 'error',
          error: `Provider ${params.provider} does not support tool calling`
        })
        return
      }

      const response: ToolCallResponse = await adapter.chatWithTools(
        {
          model: params.model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          tools: getSchemaAgentToolDefinitions(),
          stream: true
        },
        apiKey,
        baseUrl,
        (textChunk: string) => {
          sendChunk({ sessionId: params.sessionId, type: 'text', content: textChunk })
        },
        signal
      )

      if (response.content || (response.toolCalls && response.toolCalls.length > 0)) {
        messages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
          }))
        })
      }

      if (!response.toolCalls || response.toolCalls.length === 0) {
        return
      }

      for (const toolCall of response.toolCalls) {
        sendChunk({
          sessionId: params.sessionId,
          type: 'tool_call',
          toolCall: {
            id: toolCall.id,
            name: toolCall.name as SchemaAgentTool,
            arguments: toolCall.arguments
          }
        })

        const result = await this.executeTool(
          session,
          params,
          toolCall.name,
          toolCall.arguments,
          sendChunk
        )

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id
        })

        sendChunk({
          sessionId: params.sessionId,
          type: 'tool_result',
          toolResult: result
        })
      }
    }
  }

  private async executeTool(
    session: SchemaDesignSession,
    params: SchemaAgentChatParams,
    toolName: string,
    args: Record<string, unknown>,
    sendChunk: (chunk: SchemaAgentStreamChunk) => void
  ): Promise<unknown> {
    switch (toolName) {
      case 'introspect_database': {
        const connectionId = session.connectionId
        if (!connectionId)
          return {
            error:
              'No database connection. Start a session from an existing database to use introspection.'
          }
        try {
          const result = await schemaService.introspect(connectionId)
          if (!result.success || !result.schema) {
            return { error: result.error ?? 'Introspection failed' }
          }
          const design = databaseSchemaToDesign(result.schema, session.dialect)
          session.schema = design
          session.history.push(structuredClone(design))
          sendChunk({
            sessionId: params.sessionId,
            type: 'schema_updated',
            schema: design,
            changelog: ['Loaded schema from database']
          })
          return { success: true, schema: design }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Introspection failed' }
        }
      }

      case 'validate_schema': {
        const schema = normalizeSchemaDesign(args.schema)
        return validateSchemaDesign(schema)
      }

      case 'propose_schema': {
        const schema = normalizeSchemaDesign(args.schema)
        const changelog = (args.changelog as string[]) ?? []
        const validation = validateSchemaDesign(schema)
        if (!validation.valid) {
          return { error: 'Schema validation failed', errors: validation.errors }
        }
        session.schema = schema
        session.history.push(structuredClone(schema))
        sendChunk({
          sessionId: params.sessionId,
          type: 'schema_updated',
          schema,
          changelog
        })
        return { success: true, warnings: validation.warnings }
      }

      case 'generate_ddl': {
        if (!session.schema) return { error: 'No schema to generate DDL from' }
        const mode = args.mode as 'create' | 'migrate'
        const baseSchema =
          mode === 'migrate' && session.history.length > 1
            ? session.history[session.history.length - 2]
            : undefined
        return generateDDL(session.schema, mode, baseSchema)
      }

      case 'execute_ddl': {
        const statements = args.statements as string[]
        if (!session.connectionId) return { error: 'No database connection for execution' }

        sendChunk({
          sessionId: params.sessionId,
          type: 'ddl_approval',
          ddlStatements: statements
        })

        const approved = await this.waitForApproval(params.sessionId)
        if (!approved) return { error: 'User cancelled execution' }

        const results: Array<{ statement: string; success: boolean; error?: string }> = []
        for (const stmt of statements) {
          try {
            await databaseService.executeQuery(session.connectionId, stmt)
            results.push({ statement: stmt, success: true })
          } catch (err) {
            results.push({
              statement: stmt,
              success: false,
              error: err instanceof Error ? err.message : 'Execution failed'
            })
            break
          }
        }
        return { results, allSucceeded: results.every((r) => r.success) }
      }

      case 'filter_view': {
        const tableNames = args.tableNames as string[] | null
        const filter = tableNames && tableNames.length > 0 ? tableNames : null
        sendChunk({
          sessionId: params.sessionId,
          type: 'filter_changed',
          filteredTables: filter
        })
        if (filter) {
          return {
            success: true,
            showing: filter,
            message: `Showing ${filter.length} tables: ${filter.join(', ')}`
          }
        }
        return { success: true, message: 'Filter cleared — showing all tables' }
      }

      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  }

  private waitForApproval(sessionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingApprovals.set(sessionId, { resolve })
      setTimeout(() => {
        if (this.pendingApprovals.has(sessionId)) {
          this.pendingApprovals.delete(sessionId)
          resolve(false)
        }
      }, APPROVAL_TIMEOUT_MS)
    })
  }

  resolveApproval(sessionId: string, approved: boolean): void {
    const pending = this.pendingApprovals.get(sessionId)
    if (pending) {
      pending.resolve(approved)
      this.pendingApprovals.delete(sessionId)
    }
  }

  undoSchema(sessionId: string): SchemaDesign | null {
    const session = this.sessions.get(sessionId)
    if (!session || session.history.length < 2) return null
    session.history.pop()
    session.schema = structuredClone(session.history[session.history.length - 1])
    return session.schema
  }

  cancelRequest(sessionId: string): void {
    const controller = this.activeRequests.get(sessionId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(sessionId)
    }
  }
}

export const schemaAgentService = new SchemaAgentService()
