import { ipcMain } from 'electron'
import { settingsService } from '../services/settings.service'
import type { AIProvider, ProviderConfig } from '../../shared/types'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', async () => {
    return settingsService.getAll()
  })

  ipcMain.handle('settings:getTheme', async () => {
    return settingsService.getTheme()
  })

  ipcMain.handle('settings:setTheme', async (_event, theme: 'dark' | 'light') => {
    await settingsService.setTheme(theme)
  })

  ipcMain.handle('settings:get', async (_event, key: string) => {
    return settingsService.get(key)
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    await settingsService.set(key, value)
  })

  ipcMain.handle('settings:getProviderConfig', async (_event, provider: AIProvider) => {
    return settingsService.getProviderConfig(provider)
  })

  ipcMain.handle(
    'settings:setProviderConfig',
    async (_event, provider: AIProvider, config: Partial<ProviderConfig>) => {
      await settingsService.setProviderConfig(provider, config)
    }
  )

  ipcMain.handle(
    'settings:validateApiKey',
    async (_event, provider: AIProvider, apiKey: string) => {
      return settingsService.validateApiKey(provider, apiKey)
    }
  )

  ipcMain.handle('settings:fetchOllamaModels', async (_event, baseUrl: string) => {
    return settingsService.fetchOllamaModels(baseUrl)
  })
}
