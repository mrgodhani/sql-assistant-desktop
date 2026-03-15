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
  const filteredTables = ref<string[] | null>(null)
  const nodePositions = ref<Record<string, { x: number; y: number }>>({})
  const selectedNodeId = ref<string | null>(null)
  const isStreaming = ref(false)
  const streamingMessageId = ref<string | null>(null)
  const error = ref<string | null>(null)

  const hasSession = computed(() => session.value !== null)
  const hasSchema = computed(() => schema.value !== null)
  const hasFilter = computed(() => filteredTables.value !== null)
  const canUndo = computed(() => session.value !== null && (session.value.history?.length ?? 0) > 1)

  let cleanupListener: (() => void) | null = null

  async function startSession(dialect: DatabaseType, connectionId?: string): Promise<void> {
    const newSession = await window.schemaAgentApi.createSession(dialect, connectionId)
    session.value = newSession
    messages.value = []
    schema.value = null
    previousSchema.value = null
    filteredTables.value = null
    nodePositions.value = {}
    selectedNodeId.value = null
    error.value = null

    setupStreamListener()
  }

  function setupStreamListener(): void {
    if (cleanupListener) cleanupListener()

    cleanupListener = window.schemaAgentApi.onStreamChunk((chunk: SchemaAgentStreamChunk) => {
      if (chunk.sessionId !== session.value?.id) return
      handleStreamChunk(chunk)
    })
  }

  function getStreamingMessage(): DesignerMessage | undefined {
    if (streamingMessageId.value) {
      return messages.value.find((m) => m.id === streamingMessageId.value)
    }
    return messages.value.findLast((m) => m.role === 'assistant')
  }

  function handleStreamChunk(chunk: SchemaAgentStreamChunk): void {
    switch (chunk.type) {
      case 'text': {
        if (streamingMessageId.value) {
          const msg = messages.value.find((m) => m.id === streamingMessageId.value)
          if (msg) msg.content += chunk.content ?? ''
        } else {
          const newMsg: DesignerMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: chunk.content ?? ''
          }
          messages.value.push(newMsg)
          streamingMessageId.value = newMsg.id
        }
        break
      }

      case 'tool_call': {
        const toolNames: Record<string, string> = {
          introspect_database: 'Introspecting database...',
          validate_schema: 'Validating schema...',
          propose_schema: 'Updating schema design...',
          generate_ddl: 'Generating DDL...',
          execute_ddl: 'Preparing to execute DDL...',
          filter_view: 'Filtering diagram...'
        }
        const targetMsg = getStreamingMessage()
        if (targetMsg) {
          targetMsg.toolIndicator = toolNames[chunk.toolCall?.name ?? ''] ?? 'Processing...'
        }
        break
      }

      case 'tool_result': {
        const targetMsg = getStreamingMessage()
        if (targetMsg) {
          targetMsg.toolIndicator = undefined
        }
        break
      }

      case 'schema_updated': {
        previousSchema.value = schema.value ? structuredClone(schema.value) : null
        schema.value = chunk.schema ?? null
        if (session.value) {
          session.value.schema = chunk.schema ?? null
        }
        const targetMsg = getStreamingMessage()
        if (targetMsg) {
          targetMsg.changelog = chunk.changelog
          targetMsg.toolIndicator = undefined
        }
        break
      }

      case 'filter_changed': {
        filteredTables.value = chunk.filteredTables ?? null
        const targetMsg = getStreamingMessage()
        if (targetMsg) {
          targetMsg.toolIndicator = undefined
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
        streamingMessageId.value = null
        break

      case 'error':
        isStreaming.value = false
        streamingMessageId.value = null
        error.value = chunk.error ?? 'Unknown error'
        break
    }
  }

  async function sendMessage(message: string): Promise<void> {
    if (!session.value) return
    if (!message.trim()) return
    error.value = null
    streamingMessageId.value = null
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

  async function approveExecution(approved: boolean): Promise<void> {
    if (!session.value) return
    await window.schemaAgentApi.resolveApproval(session.value.id, approved)

    const approvalMsg = [...messages.value].reverse().find((m) => m.awaitingApproval)
    if (approvalMsg) {
      approvalMsg.awaitingApproval = false
      approvalMsg.content = approved ? 'DDL execution approved.' : 'DDL execution cancelled.'
    }
  }

  async function undo(): Promise<void> {
    if (!session.value) return
    const result = await window.schemaAgentApi.undo(session.value.id)
    if (result) {
      previousSchema.value = schema.value
      schema.value = result
    }
  }

  function clearFilter(): void {
    filteredTables.value = null
  }

  function cancel(): void {
    if (session.value) {
      window.schemaAgentApi.cancel(session.value.id)
      isStreaming.value = false
      streamingMessageId.value = null
    }
  }

  async function endSession(): Promise<void> {
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
    filteredTables.value = null
    nodePositions.value = {}
    selectedNodeId.value = null
    error.value = null
  }

  function setFilter(tables: string[] | null): void {
    filteredTables.value = tables
  }

  function setNodePosition(nodeId: string, position: { x: number; y: number }): void {
    nodePositions.value = { ...nodePositions.value, [nodeId]: position }
  }

  function clearNodePositions(): void {
    nodePositions.value = {}
  }

  function setSelectedNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  function getConnectedTableIds(nodeId: string): string[] {
    if (!schema.value) return []
    const tables = schema.value.tables
    const tableIdSet = new Set(tables.map((t) => (t.schema ? `${t.schema}.${t.name}` : t.name)))
    const nameToId = new Map(tables.map((t) => [t.name, t.schema ? `${t.schema}.${t.name}` : t.name]))
    const connected = new Set<string>([nodeId])
    for (const t of tables) {
      const srcId = t.schema ? `${t.schema}.${t.name}` : t.name
      for (const col of t.columns ?? []) {
        if (!col.foreignKey) continue
        const targetName = col.foreignKey.table
        const targetId = tableIdSet.has(targetName) ? targetName : (nameToId.get(targetName) ?? null)
        if (!targetId) continue
        if (srcId === nodeId) connected.add(targetId)
        if (targetId === nodeId) connected.add(srcId)
      }
    }
    return Array.from(connected)
  }

  return {
    session,
    messages,
    schema,
    previousSchema,
    filteredTables,
    nodePositions,
    selectedNodeId,
    isStreaming,
    streamingMessageId,
    error,
    hasSession,
    hasSchema,
    hasFilter,
    canUndo,
    startSession,
    sendMessage,
    approveExecution,
    clearFilter,
    setFilter,
    setNodePosition,
    clearNodePositions,
    setSelectedNode,
    getConnectedTableIds,
    undo,
    cancel,
    endSession
  }
})
