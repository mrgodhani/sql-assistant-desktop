import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SchemaDesign,
  SchemaDesignSession,
  SchemaAgentStreamChunk,
  DatabaseType
} from '../../../shared/types'
import { useSettingsStore } from './useSettingsStore'

export interface DesignerMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  changelog?: string[]
  ddlStatements?: string[]
  awaitingApproval?: boolean
  toolIndicator?: string
}

export const useSchemaDesignerStore = defineStore('schemaDesigner', () => {
  const settingsStore = useSettingsStore()

  const session = ref<SchemaDesignSession | null>(null)
  const messages = ref<DesignerMessage[]>([])
  const schema = ref<SchemaDesign | null>(null)
  const previousSchema = ref<SchemaDesign | null>(null)
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  const hasSession = computed(() => session.value !== null)
  const hasSchema = computed(() => schema.value !== null)
  const canUndo = computed(
    () => session.value !== null && (session.value.history?.length ?? 0) > 1
  )

  let cleanupListener: (() => void) | null = null

  async function startSession(dialect: DatabaseType, connectionId?: string) {
    const newSession = await window.schemaAgentApi.createSession(dialect, connectionId)
    session.value = newSession
    messages.value = []
    schema.value = null
    previousSchema.value = null
    error.value = null

    setupStreamListener()
  }

  function setupStreamListener() {
    if (cleanupListener) cleanupListener()

    cleanupListener = window.schemaAgentApi.onStreamChunk(
      (chunk: SchemaAgentStreamChunk) => {
        if (chunk.sessionId !== session.value?.id) return
        handleStreamChunk(chunk)
      }
    )
  }

  function handleStreamChunk(chunk: SchemaAgentStreamChunk) {
    switch (chunk.type) {
      case 'text': {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg?.role === 'assistant' && !lastMsg.awaitingApproval) {
          lastMsg.content += chunk.content ?? ''
        } else {
          messages.value.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: chunk.content ?? ''
          })
        }
        break
      }

      case 'tool_call': {
        const toolNames: Record<string, string> = {
          introspect_database: 'Introspecting database...',
          validate_schema: 'Validating schema...',
          propose_schema: 'Updating schema design...',
          generate_ddl: 'Generating DDL...',
          execute_ddl: 'Preparing to execute DDL...'
        }
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg?.role === 'assistant') {
          lastMsg.toolIndicator = toolNames[chunk.toolCall?.name ?? ''] ?? 'Processing...'
        }
        break
      }

      case 'tool_result': {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg?.role === 'assistant') {
          lastMsg.toolIndicator = undefined
        }
        break
      }

      case 'schema_updated': {
        previousSchema.value = schema.value ? structuredClone(schema.value) : null
        schema.value = chunk.schema ?? null
        if (session.value) {
          session.value.schema = chunk.schema ?? null
        }
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg?.role === 'assistant') {
          lastMsg.changelog = chunk.changelog
          lastMsg.toolIndicator = undefined
        }
        break
      }

      case 'ddl_approval': {
        messages.value.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Review the DDL statements below before executing:',
          ddlStatements: chunk.ddlStatements,
          awaitingApproval: true
        })
        break
      }

      case 'done':
        isStreaming.value = false
        break

      case 'error':
        isStreaming.value = false
        error.value = chunk.error ?? 'Unknown error'
        break
    }
  }

  async function sendMessage(message: string) {
    if (!session.value) return
    if (!message.trim()) return
    error.value = null
    isStreaming.value = true

    messages.value.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: message.trim()
    })

    await window.schemaAgentApi.chat({
      sessionId: session.value.id,
      message: message.trim(),
      connectionId: session.value.connectionId,
      provider: settingsStore.activeProvider,
      model: settingsStore.activeModel
    })
  }

  async function approveExecution(approved: boolean) {
    if (!session.value) return
    await window.schemaAgentApi.resolveApproval(session.value.id, approved)

    const approvalMsg = [...messages.value].reverse().find((m) => m.awaitingApproval)
    if (approvalMsg) {
      approvalMsg.awaitingApproval = false
      approvalMsg.content = approved ? 'DDL execution approved.' : 'DDL execution cancelled.'
    }
  }

  async function undo() {
    if (!session.value) return
    const result = await window.schemaAgentApi.undo(session.value.id)
    if (result) {
      previousSchema.value = schema.value
      schema.value = result
    }
  }

  function cancel() {
    if (session.value) {
      window.schemaAgentApi.cancel(session.value.id)
      isStreaming.value = false
    }
  }

  async function endSession() {
    if (session.value) {
      await window.schemaAgentApi.deleteSession(session.value.id)
    }
    if (cleanupListener) {
      cleanupListener()
      cleanupListener = null
    }
    session.value = null
    messages.value = []
    schema.value = null
    previousSchema.value = null
    error.value = null
  }

  return {
    session,
    messages,
    schema,
    previousSchema,
    isStreaming,
    error,
    hasSession,
    hasSchema,
    canUndo,
    startSession,
    sendMessage,
    approveExecution,
    undo,
    cancel,
    endSession
  }
})
