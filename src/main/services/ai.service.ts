import log from 'electron-log/main'
import { settingsService } from './settings.service'
import { schemaService } from './schema.service'
import { databaseService } from './database.service'
import { buildSystemPrompt, buildOptimizationPrompt } from './ai/prompt'
import { classifyError } from './ai/types'
import { openaiAdapter } from './ai/openai.adapter'
import { anthropicAdapter } from './ai/anthropic.adapter'
import { googleAdapter } from './ai/google.adapter'
import { ollamaAdapter } from './ai/ollama.adapter'
import { openrouterAdapter } from './ai/openrouter.adapter'
import type { ProviderAdapter } from './ai/types'
import type { AIProvider, AIChatParams, StreamChunk, ChatMessage } from '../../shared/types'
import { DEFAULT_PROVIDER_CONFIGS } from '../../shared/types'

const STREAM_INACTIVITY_TIMEOUT = 60_000

function getAdapter(provider: AIProvider): ProviderAdapter {
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
        }
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
