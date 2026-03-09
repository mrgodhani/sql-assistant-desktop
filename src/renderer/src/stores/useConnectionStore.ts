import log from 'electron-log/renderer'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DatabaseConnection,
  ConnectionConfig,
  ConnectionStatus,
  ConnectionTestResult
} from '../../../shared/types'

interface ConnectionStatusEntry {
  status: ConnectionStatus
  error?: string
}

export const useConnectionStore = defineStore('connections', () => {
  const connections = ref<DatabaseConnection[]>([])
  const connectionStatuses = ref<Record<string, ConnectionStatusEntry>>({})
  const isLoading = ref(false)

  const connectedConnections = computed(() =>
    connections.value.filter((c) => connectionStatuses.value[c.id]?.status === 'connected')
  )

  function getConnection(id: string): DatabaseConnection | undefined {
    return connections.value.find((c) => c.id === id)
  }

  function getStatus(id: string): ConnectionStatusEntry {
    return connectionStatuses.value[id] || { status: 'disconnected' }
  }

  function setStatus(id: string, status: ConnectionStatus, error?: string): void {
    connectionStatuses.value[id] = { status, error }
  }

  async function loadConnections(): Promise<void> {
    isLoading.value = true
    try {
      connections.value = await window.connectionsApi.list()
      for (const conn of connections.value) {
        if (!connectionStatuses.value[conn.id]) {
          setStatus(conn.id, 'disconnected')
        }
      }
    } catch (error) {
      log.error('[Connections] Failed to load connections:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function createConnection(config: ConnectionConfig): Promise<DatabaseConnection | null> {
    if (!window.connectionsApi) {
      const msg =
        'Electron APIs not available. Run the app with "npm run dev" or the built executable.'
      log.error('[Connections]', msg)
      throw new Error(msg)
    }
    try {
      const conn = await window.connectionsApi.create(config)
      connections.value.push(conn)
      setStatus(conn.id, 'disconnected')
      return conn
    } catch (error) {
      log.error('[Connections] Failed to create connection:', error)
      throw error
    }
  }

  async function updateConnection(
    id: string,
    config: ConnectionConfig
  ): Promise<DatabaseConnection | null> {
    try {
      const conn = await window.connectionsApi.update(id, config)
      const idx = connections.value.findIndex((c) => c.id === id)
      if (idx !== -1) connections.value[idx] = conn
      setStatus(id, 'disconnected')
      return conn
    } catch (error) {
      log.error('[Connections] Failed to update connection:', error)
      throw error
    }
  }

  async function deleteConnection(id: string): Promise<void> {
    try {
      await window.connectionsApi.delete(id)
      connections.value = connections.value.filter((c) => c.id !== id)
      delete connectionStatuses.value[id]
    } catch (error) {
      log.error('[Connections] Failed to delete connection:', error)
      throw error
    }
  }

  async function connect(id: string): Promise<void> {
    setStatus(id, 'connecting')
    try {
      const result = await window.connectionsApi.connect(id)
      if (result.success) {
        setStatus(id, 'connected')
      } else {
        setStatus(id, 'error', result.error)
      }
    } catch (error) {
      setStatus(id, 'error', 'Connection failed unexpectedly')
      log.error('[Connections] Connect failed:', error)
    }
  }

  async function disconnect(id: string): Promise<void> {
    try {
      await window.connectionsApi.disconnect(id)
      setStatus(id, 'disconnected')
    } catch (error) {
      log.error('[Connections] Disconnect failed:', error)
    }
  }

  async function testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    try {
      return await window.connectionsApi.test(config)
    } catch (error) {
      log.error('[Connections] Test connection failed:', error)
      return { success: false, message: 'Test request failed' }
    }
  }

  async function pickSQLiteFile(): Promise<string | null> {
    try {
      return await window.connectionsApi.pickSqliteFile()
    } catch (error) {
      log.error('[Connections] File picker failed:', error)
      return null
    }
  }

  return {
    connections,
    connectionStatuses,
    isLoading,
    connectedConnections,
    getConnection,
    getStatus,
    loadConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    connect,
    disconnect,
    testConnection,
    pickSQLiteFile
  }
})
