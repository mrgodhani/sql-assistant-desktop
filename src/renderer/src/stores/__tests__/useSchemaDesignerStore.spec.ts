import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSchemaDesignerStore } from '../useSchemaDesignerStore'
import type { SchemaAgentStreamChunk } from '../../../../shared/types'

vi.mock('electron-log/renderer', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

/** Simulate the IPC stream by capturing the callback passed to onStreamChunk */
function setupStoreWithSession(sessionId = 'test-session') {
  let streamCallback: ((chunk: SchemaAgentStreamChunk) => void) | null = null

  const mockSession = {
    id: sessionId,
    dialect: 'postgresql' as const,
    schema: null,
    history: []
  }

  const mockApi = {
    createSession: vi.fn().mockResolvedValue(mockSession),
    chat: vi.fn().mockResolvedValue({ sessionId }),
    cancel: vi.fn(),
    onStreamChunk: vi.fn((cb: (chunk: SchemaAgentStreamChunk) => void) => {
      streamCallback = cb
      return () => {
        streamCallback = null
      }
    }),
    getSession: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    resolveApproval: vi.fn(),
    undo: vi.fn()
  }

  Object.defineProperty(globalThis, 'window', {
    value: { ...globalThis.window, schemaAgentApi: mockApi },
    writable: true,
    configurable: true
  })

  const store = useSchemaDesignerStore()

  return {
    store,
    mockApi,
    sendChunk: (chunk: Omit<SchemaAgentStreamChunk, 'sessionId'>) => {
      streamCallback?.({ ...chunk, sessionId } as SchemaAgentStreamChunk)
    },
    startSession: async () => {
      await store.startSession('postgresql')
    }
  }
}

describe('useSchemaDesignerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ─── Existing tests ────────────────────────────────────────────────────────

  it('setFilter updates filteredTables and hasFilter', () => {
    const store = useSchemaDesignerStore()
    store.setFilter(['a'])
    expect(store.filteredTables).toEqual(['a'])
    expect(store.hasFilter).toBe(true)
  })

  it('setFilter null clears filter', () => {
    const store = useSchemaDesignerStore()
    store.setFilter(['a'])
    expect(store.filteredTables).toEqual(['a'])
    store.setFilter(null)
    expect(store.filteredTables).toBeNull()
  })

  it('setNodePosition stores position', () => {
    const store = useSchemaDesignerStore()
    store.setNodePosition('users', { x: 10, y: 20 })
    expect(store.nodePositions['users']).toEqual({ x: 10, y: 20 })
  })

  it('clearNodePositions clears all', () => {
    const store = useSchemaDesignerStore()
    store.setNodePosition('users', { x: 10, y: 20 })
    expect(store.nodePositions['users']).toEqual({ x: 10, y: 20 })
    store.clearNodePositions()
    expect(store.nodePositions).toEqual({})
  })

  // ─── streamingMessageId — Bug 1 regression tests ─────────────────────────

  describe('streamingMessageId tracking', () => {
    it('is null initially', async () => {
      const { store, startSession } = setupStoreWithSession()
      await startSession()
      expect(store.streamingMessageId).toBeNull()
    })

    it('is set to the new message id on first text chunk', async () => {
      const { store, startSession, sendChunk } = setupStoreWithSession()
      await startSession()

      sendChunk({ type: 'text', content: 'Hello' })

      expect(store.streamingMessageId).not.toBeNull()
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0].id).toBe(store.streamingMessageId)
      expect(store.messages[0].content).toBe('Hello')
    })

    it('appends subsequent text chunks to the same message', async () => {
      const { store, startSession, sendChunk } = setupStoreWithSession()
      await startSession()

      sendChunk({ type: 'text', content: 'Hello' })
      const firstId = store.streamingMessageId

      sendChunk({ type: 'text', content: ' world' })

      expect(store.streamingMessageId).toBe(firstId)
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0].content).toBe('Hello world')
    })

    it('does NOT create a new message on subsequent text chunks', async () => {
      const { store, startSession, sendChunk } = setupStoreWithSession()
      await startSession()

      sendChunk({ type: 'text', content: 'First' })
      sendChunk({ type: 'text', content: ' Second' })
      sendChunk({ type: 'text', content: ' Third' })

      expect(store.messages).toHaveLength(1)
      expect(store.messages[0].content).toBe('First Second Third')
    })

    it('is cleared on done chunk', async () => {
      const { store, startSession, sendChunk } = setupStoreWithSession()
      await startSession()

      sendChunk({ type: 'text', content: 'Hello' })
      expect(store.streamingMessageId).not.toBeNull()

      sendChunk({ type: 'done' })

      expect(store.streamingMessageId).toBeNull()
      expect(store.isStreaming).toBe(false)
    })

    it('is cleared on error chunk', async () => {
      const { store, startSession, sendChunk } = setupStoreWithSession()
      await startSession()

      sendChunk({ type: 'text', content: 'Hello' })
      sendChunk({ type: 'error', error: 'Something went wrong' })

      expect(store.streamingMessageId).toBeNull()
      expect(store.isStreaming).toBe(false)
      expect(store.error).toBe('Something went wrong')
    })

    it('is reset to null at the start of each new sendMessage turn', async () => {
      const { store, startSession, sendChunk } = setupStoreWithSession()
      await startSession()

      // Simulate first turn
      sendChunk({ type: 'text', content: 'Turn one' })
      sendChunk({ type: 'done' })
      expect(store.streamingMessageId).toBeNull()

      // sendMessage resets streamingMessageId before starting
      const chatPromise = store.sendMessage('Next question')
      expect(store.streamingMessageId).toBeNull()
      expect(store.isStreaming).toBe(true)
      await chatPromise

      // Second turn should create a separate message
      sendChunk({ type: 'text', content: 'Turn two' })
      expect(store.messages).toHaveLength(3) // user(1) + assistant(1) + user(2) + ... wait
      const assistantMessages = store.messages.filter((m) => m.role === 'assistant')
      expect(assistantMessages).toHaveLength(2)
      expect(assistantMessages[1].content).toBe('Turn two')
    })

    it('is cleared by cancel()', async () => {
      const { store, startSession, sendChunk } = setupStoreWithSession()
      await startSession()

      sendChunk({ type: 'text', content: 'Partial' })
      expect(store.streamingMessageId).not.toBeNull()

      store.cancel()

      expect(store.streamingMessageId).toBeNull()
      expect(store.isStreaming).toBe(false)
    })
  })
})
