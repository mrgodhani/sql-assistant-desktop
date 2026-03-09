import { ipcMain, BrowserWindow } from 'electron'
import { aiService } from '../services/ai.service'
import type { AIChatParams, AIProvider } from '../../shared/types'
import { AI_PROVIDERS } from '../../shared/types'

export function registerAiIpc(): void {
  ipcMain.handle('ai:chat-stream', async (event, params: AIChatParams) => {
    if (!params?.requestId || typeof params.requestId !== 'string') {
      return { error: 'Request ID is required' }
    }
    if (!params.provider || !AI_PROVIDERS.includes(params.provider)) {
      return { error: 'Valid provider is required' }
    }
    if (!params.model || typeof params.model !== 'string') {
      return { error: 'Model is required' }
    }

    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { error: 'Window not found' }

    aiService
      .chatStream(params, (chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:stream-chunk', chunk)
        }
      })
      .catch((err) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:stream-chunk', {
            requestId: params.requestId,
            chunk: '',
            done: true,
            error: err instanceof Error ? err.message : 'Stream failed'
          })
        }
      })

    return { requestId: params.requestId }
  })

  ipcMain.on('ai:cancel', (_event, requestId: string) => {
    if (requestId && typeof requestId === 'string') {
      aiService.cancelRequest(requestId)
    }
  })

  ipcMain.handle('ai:list-models', async (_event, provider: AIProvider) => {
    if (!provider || !AI_PROVIDERS.includes(provider)) return []
    return aiService.listModels(provider)
  })
}
