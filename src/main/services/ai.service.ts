import log from 'electron-log/main'
import { settingsService } from './settings.service'
import { schemaService } from './schema.service'
import { databaseService } from './database.service'
import { buildSystemPrompt, buildOptimizationPrompt, buildDesignerSystemPrompt } from './ai/prompt'
import { classifyError } from './ai/types'
import { openaiAdapter } from './ai/openai.adapter'
import { anthropicAdapter } from './ai/anthropic.adapter'
import { googleAdapter } from './ai/google.adapter'
import { ollamaAdapter } from './ai/ollama.adapter'
import { openrouterAdapter } from './ai/openrouter.adapter'
import type { ProviderAdapter } from './ai/types'
import type {
  AIProvider,
  AIChatParams,
  StreamChunk,
  ChatMessage,
  DesignerGenerateResult,
  DesignerSchema,
  DesignerTable,
  DesignerColumn,
  DesignerRelationship
} from '../../shared/types'
import { DEFAULT_PROVIDER_CONFIGS, DEFAULT_TEMPERATURE } from '../../shared/types'

const STREAM_INACTIVITY_TIMEOUT = 60_000

export function getAdapter(provider: AIProvider): ProviderAdapter {
  switch (provider) {
    case 'openai':
      return openaiAdapter
    case 'anthropic':
      return anthropicAdapter
    case 'google':
      return googleAdapter
    case 'ollama':
      return ollamaAdapter
    case 'openrouter':
      return openrouterAdapter
  }
}

class AIService {
  private activeRequests: Map<string, AbortController> = new Map()

  async chatStream(params: AIChatParams, sendChunk: (chunk: StreamChunk) => void): Promise<void> {
    const { provider, model, messages, schemaContext, databaseType, connectionName, requestId } =
      params

    const controller = this.registerRequest(requestId)

    try {
      const config = await settingsService.getProviderConfig(provider)
      const apiKey = config.apiKey ?? ''
      const baseUrl = config.baseUrl ?? DEFAULT_PROVIDER_CONFIGS[provider].baseUrl ?? ''
      const allSettings = await settingsService.getAll()
      const temperature = allSettings.temperature ?? DEFAULT_TEMPERATURE

      if (provider !== 'ollama' && !apiKey) {
        sendChunk({
          requestId,
          chunk: '',
          done: true,
          error: `No API key configured for ${provider}. Add one in Settings.`
        })
        return
      }

      const systemPrompt =
        params.systemPromptOverride ??
        buildSystemPrompt(schemaContext, databaseType, connectionName)
      const adapter = getAdapter(provider)

      const watchdog = this.createWatchdog(controller)

      await adapter.chatStream(
        messages,
        model,
        systemPrompt,
        apiKey,
        baseUrl,
        controller.signal,
        (text: string) => {
          watchdog.reset()
          sendChunk({ requestId, chunk: text, done: false })
        },
        temperature
      )

      watchdog.clear()
      sendChunk({ requestId, chunk: '', done: true })
    } catch (error) {
      log.error(`[AI] chatStream error for ${provider}/${model}:`, error)
      const classified = classifyError(error, provider)
      sendChunk({ requestId, chunk: '', done: true, error: classified.message })
    } finally {
      this.cleanupRequest(requestId)
    }
  }

  cancelRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
    }
  }

  async optimizeQuery(connectionId: string, sql: string): Promise<string> {
    const settings = await settingsService.getAll()
    const provider = settings.activeProvider
    const model = settings.activeModel
    if (!model) {
      throw new Error('No AI model selected. Configure a provider in Settings.')
    }

    const config = await settingsService.getProviderConfig(provider)
    if (provider !== 'ollama' && !config.apiKey) {
      throw new Error(`No API key configured for ${provider}. Add one in Settings.`)
    }

    let schemaContext = ''
    let databaseType: import('../../shared/types').DatabaseType | undefined
    let connectionName: string | undefined

    try {
      schemaContext = schemaService.getSchemaContext(connectionId)
      const conn = await databaseService.getConnection(connectionId)
      if (conn) {
        databaseType = conn.type
        connectionName = conn.name
      }
    } catch {
      // continue without schema
    }

    const systemPrompt = buildOptimizationPrompt(sql, schemaContext, databaseType, connectionName)
    const messages: ChatMessage[] = [
      { role: 'user', content: `Optimize this query:\n\n\`\`\`sql\n${sql}\n\`\`\`` }
    ]

    const requestId = `optimize-${Date.now()}`
    let collected = ''
    let streamError: string | null = null

    await this.chatStream(
      {
        provider,
        model,
        messages,
        schemaContext,
        databaseType,
        connectionName,
        requestId,
        systemPromptOverride: systemPrompt
      },
      (chunk) => {
        if (chunk.chunk) collected += chunk.chunk
        if (chunk.error) streamError = chunk.error
      }
    )

    if (streamError) {
      throw new Error(streamError)
    }
    return collected
  }

  async listModels(provider: AIProvider): Promise<string[]> {
    const config = await settingsService.getProviderConfig(provider)
    const apiKey = config.apiKey ?? ''
    const baseUrl = config.baseUrl ?? DEFAULT_PROVIDER_CONFIGS[provider].baseUrl ?? ''

    const adapter = getAdapter(provider)
    const defaults = DEFAULT_PROVIDER_CONFIGS[provider].models

    try {
      const dynamic = await adapter.listModels(apiKey, baseUrl)
      const merged = [...defaults]
      for (const model of dynamic) {
        if (!merged.includes(model)) merged.push(model)
      }
      return merged
    } catch {
      return defaults
    }
  }

  async generateDesignerSchema(prompt: string): Promise<DesignerGenerateResult> {
    const settings = await settingsService.getAll()
    const provider = settings.activeProvider
    const model = settings.activeModel
    if (!model) {
      return { success: false, error: 'No AI model selected. Configure a provider in Settings.' }
    }

    const config = await settingsService.getProviderConfig(provider)
    if (provider !== 'ollama' && !config.apiKey) {
      return {
        success: false,
        error: `No API key configured for ${provider}. Add one in Settings.`
      }
    }

    const systemPrompt = buildDesignerSystemPrompt()
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
    const requestId = `designer-${Date.now()}`

    let collected = ''
    let streamError: string | null = null

    await this.chatStream(
      {
        provider,
        model,
        messages,
        requestId,
        systemPromptOverride: systemPrompt
      },
      (chunk: StreamChunk) => {
        if (chunk.chunk) collected += chunk.chunk
        if (chunk.error) streamError = chunk.error
      }
    )

    if (streamError) {
      return { success: false, error: streamError }
    }

    try {
      const cleaned = collected
        .trim()
        .replace(/^```+\w*\s*/i, '')
        .replace(/```+\s*$/, '')
        .trim()
      const raw = JSON.parse(cleaned) as {
        tables?: Array<{
          name: string
          columns: Array<{ name: string; type: string; nullable: boolean; isPrimaryKey: boolean }>
        }>
        relationships?: Array<{
          fromTable: string
          fromColumn: string
          toTable: string
          toColumn: string
          type: string
        }>
      }

      const tableNameToId = new Map<string, string>()

      const tables: DesignerTable[] = (raw.tables ?? []).map((t) => {
        const tableId = crypto.randomUUID()
        tableNameToId.set(t.name, tableId)
        const columns: DesignerColumn[] = (t.columns ?? []).map((c) => ({
          id: crypto.randomUUID(),
          name: c.name,
          type: c.type,
          nullable: Boolean(c.nullable),
          isPrimaryKey: Boolean(c.isPrimaryKey)
        }))
        return { id: tableId, name: t.name, columns }
      })

      const columnNameToId = new Map<string, string>()
      for (const t of tables) {
        for (const c of t.columns) {
          columnNameToId.set(`${t.name}.${c.name}`, c.id)
        }
      }

      const relationships: DesignerRelationship[] = []
      for (const r of raw.relationships ?? []) {
        const fromTableId = tableNameToId.get(r.fromTable)
        const toTableId = tableNameToId.get(r.toTable)
        const fromColumnId = columnNameToId.get(`${r.fromTable}.${r.fromColumn}`)
        const toColumnId = columnNameToId.get(`${r.toTable}.${r.toColumn}`)
        if (!fromTableId || !toTableId || !fromColumnId || !toColumnId) continue
        const validTypes = ['1:1', '1:N', 'N:M'] as const
        const relType: '1:1' | '1:N' | 'N:M' = validTypes.includes(r.type as '1:1' | '1:N' | 'N:M')
          ? (r.type as '1:1' | '1:N' | 'N:M')
          : '1:N'
        relationships.push({
          id: crypto.randomUUID() as string,
          fromTableId,
          fromColumnId,
          toTableId,
          toColumnId,
          type: relType
        })
      }

      const schema: DesignerSchema = { tables, relationships }
      return { success: true, schema }
    } catch (err) {
      log.error('[AI] generateDesignerSchema parse error:', err)
      return {
        success: false,
        error: `The AI response could not be parsed as valid JSON. Try rephrasing your description.`
      }
    }
  }

  cancelAll(): void {
    for (const [id, controller] of this.activeRequests) {
      controller.abort()
      this.activeRequests.delete(id)
    }
  }

  private registerRequest(requestId: string): AbortController {
    const existing = this.activeRequests.get(requestId)
    if (existing) existing.abort()

    const controller = new AbortController()
    this.activeRequests.set(requestId, controller)
    return controller
  }

  private cleanupRequest(requestId: string): void {
    this.activeRequests.delete(requestId)
  }

  private createWatchdog(controller: AbortController): { reset: () => void; clear: () => void } {
    let timer: ReturnType<typeof setTimeout>
    const reset = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => controller.abort(), STREAM_INACTIVITY_TIMEOUT)
    }
    const clear = (): void => clearTimeout(timer)
    reset()
    return { reset, clear }
  }
}

export const aiService = new AIService()
