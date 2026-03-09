import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Conversation, ConversationSummary, StreamingState } from '../../../shared/types'
import { useSettingsStore } from './useSettingsStore'
import { useConnectionStore } from './useConnectionStore'

const MAX_MESSAGE_LENGTH = 65_536

export const useChatStore = defineStore('chat', () => {
  const settingsStore = useSettingsStore()
  const connectionStore = useConnectionStore()

  const currentConversation = ref<Conversation | null>(null)
  const streamingState = ref<StreamingState | null>(null)
  const activeConnectionId = ref<string | null>(null)
  const conversations = ref<ConversationSummary[]>([])
  const inputContentForEdit = ref<string | null>(null)

  function validateMessage(text: string): string | null {
    const trimmed = text.trim()
    if (!trimmed) return null
    if (trimmed.length > MAX_MESSAGE_LENGTH) return 'Message too long'
    return trimmed
  }

  function setActiveConnection(id: string | null): void {
    activeConnectionId.value = id
  }

  async function startNewConversation(): Promise<void> {
    try {
      const created = await window.conversationApi.create(activeConnectionId.value)
      currentConversation.value = {
        ...created,
        messages: created.messages.map((m) => ({ ...m, id: m.id }))
      }
    } catch {
      const now = new Date().toISOString()
      currentConversation.value = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        connectionId: activeConnectionId.value,
        messages: [],
        createdAt: now,
        updatedAt: now
      }
    }
  }

  async function loadConversation(id: string): Promise<void> {
    try {
      const conv = await window.conversationApi.get(id)
      if (conv) {
        currentConversation.value = conv
      }
    } catch {
      currentConversation.value = null
    }
  }

  async function loadConversations(): Promise<void> {
    try {
      conversations.value = await window.conversationApi.list()
    } catch {
      conversations.value = []
    }
  }

  function setupStreamListener(requestId: string, messageIndex: number, onDone: () => void): void {
    const handler = (chunk: {
      requestId: string
      chunk: string
      done: boolean
      error?: string
    }) => {
      if (chunk.requestId !== requestId) return

      const conv = currentConversation.value
      if (!conv || messageIndex >= conv.messages.length) return

      if (chunk.done) {
        if (chunk.error) {
          conv.messages[messageIndex].content += `\n\n**Error:** ${chunk.error}`
        }
        streamingState.value = null
        window.aiApi.offStreamChunk()
        onDone()
        return
      }

      streamingState.value = {
        requestId,
        messageIndex,
        accumulatedContent: (streamingState.value?.accumulatedContent ?? '') + chunk.chunk
      }
      conv.messages[messageIndex].content = streamingState.value.accumulatedContent
    }

    window.aiApi.onStreamChunk(handler)
  }

  async function sendMessage(text: string): Promise<void> {
    const validated = validateMessage(text)
    if (!validated) return
    if (streamingState.value) return

    if (!currentConversation.value) {
      await startNewConversation()
    }

    const conv = currentConversation.value
    if (!conv) return

    try {
      const userMessageId = await window.conversationApi.addMessage(conv.id, 'user', validated)
      conv.messages.push({ id: userMessageId, role: 'user', content: validated })
    } catch {
      conv.messages.push({ role: 'user', content: validated })
    }

    conv.messages.push({ role: 'assistant', content: '' })
    conv.updatedAt = new Date().toISOString()

    if (conv.messages.length === 2) {
      const title = validated.slice(0, 50) + (validated.length > 50 ? '...' : '')
      conv.title = title
      try {
        await window.conversationApi.updateTitle(conv.id, title)
      } catch {
        // ignore
      }
    }

    const messageIndex = conv.messages.length - 1
    const requestId = crypto.randomUUID()

    let schemaContext = ''
    let databaseType: 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver' | undefined
    let connectionName: string | undefined

    if (activeConnectionId.value) {
      try {
        schemaContext = await window.schemaApi.getContext(activeConnectionId.value)
        const conn = connectionStore.getConnection(activeConnectionId.value)
        if (conn) {
          databaseType = conn.type
          connectionName = conn.name
        }
      } catch {
        // continue without schema
      }
    }

    const provider = settingsStore.activeProvider
    const model = settingsStore.activeModel

    if (!model) return

    const onStreamDone = async (): Promise<void> => {
      const assistantContent = conv.messages[messageIndex]?.content ?? ''
      try {
        const assistantMessageId = await window.conversationApi.addMessage(
          conv.id,
          'assistant',
          assistantContent
        )
        if (conv.messages[messageIndex]) {
          conv.messages[messageIndex].id = assistantMessageId
        }
      } catch {
        // ignore
      }
      await loadConversations()
    }

    setupStreamListener(requestId, messageIndex, onStreamDone)
    streamingState.value = { requestId, messageIndex, accumulatedContent: '' }

    try {
      await window.aiApi.chatStream({
        provider,
        model,
        messages: conv.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        schemaContext: schemaContext || undefined,
        databaseType,
        connectionName,
        requestId
      })
    } catch (err) {
      conv.messages[messageIndex].content =
        `**Error:** ${err instanceof Error ? err.message : 'Request failed'}`
      streamingState.value = null
      window.aiApi.offStreamChunk()
      onStreamDone()
    }
  }

  function clearInputContentForEdit(): void {
    inputContentForEdit.value = null
  }

  function editAndResend(messageIndex: number): void {
    const conv = currentConversation.value
    if (!conv || streamingState.value) return
    const msg = conv.messages[messageIndex]
    if (!msg || msg.role !== 'user') return
    inputContentForEdit.value = msg.content
    conv.messages.splice(messageIndex)
    window.conversationApi.truncate(conv.id, messageIndex)
  }

  function cancelRequest(): void {
    const req = streamingState.value
    if (req) {
      window.aiApi.cancel(req.requestId)
      window.aiApi.offStreamChunk()
      streamingState.value = null
    }
  }

  return {
    currentConversation,
    streamingState,
    activeConnectionId,
    conversations,
    inputContentForEdit,
    sendMessage,
    editAndResend,
    clearInputContentForEdit,
    cancelRequest,
    startNewConversation,
    loadConversation,
    loadConversations,
    setActiveConnection,
    validateMessage
  }
})
