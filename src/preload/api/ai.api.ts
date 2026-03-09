import { ipcRenderer } from 'electron'
import type { AIChatParams, AIProvider, StreamChunk } from '../../shared/types'

export const aiApi = {
  chatStream: (params: AIChatParams): Promise<{ requestId: string }> =>
    ipcRenderer.invoke('ai:chat-stream', params),

  cancel: (requestId: string): void => ipcRenderer.send('ai:cancel', requestId),

  listModels: (provider: AIProvider): Promise<string[]> =>
    ipcRenderer.invoke('ai:list-models', provider),

  onStreamChunk: (callback: (chunk: StreamChunk) => void): void => {
    ipcRenderer.on('ai:stream-chunk', (_event, chunk: StreamChunk) => callback(chunk))
  },

  offStreamChunk: (): void => {
    ipcRenderer.removeAllListeners('ai:stream-chunk')
  }
}
