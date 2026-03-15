import { ipcRenderer } from 'electron'
import type {
  SchemaAgentChatParams,
  SchemaAgentStreamChunk,
  SchemaDesignSession,
  SchemaDesign,
  DatabaseType
} from '../../shared/types'

export const schemaAgentApi = {
  createSession: (dialect: DatabaseType, connectionId?: string): Promise<SchemaDesignSession> =>
    ipcRenderer.invoke('schema-agent:create-session', dialect, connectionId),

  chat: (params: SchemaAgentChatParams): Promise<{ sessionId: string }> =>
    ipcRenderer.invoke('schema-agent:chat', params),

  getSession: (sessionId: string): Promise<SchemaDesignSession | null> =>
    ipcRenderer.invoke('schema-agent:get-session', sessionId),

  deleteSession: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('schema-agent:delete-session', sessionId),

  resolveApproval: (sessionId: string, approved: boolean): Promise<void> =>
    ipcRenderer.invoke('schema-agent:resolve-approval', sessionId, approved),

  undo: (sessionId: string): Promise<SchemaDesign | null> =>
    ipcRenderer.invoke('schema-agent:undo', sessionId),

  cancel: (sessionId: string): void => ipcRenderer.send('schema-agent:cancel', sessionId),

  onStreamChunk: (callback: (chunk: SchemaAgentStreamChunk) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: SchemaAgentStreamChunk): void =>
      callback(chunk)
    ipcRenderer.on('schema-agent:stream-chunk', handler)
    return () => ipcRenderer.removeListener('schema-agent:stream-chunk', handler)
  }
}
