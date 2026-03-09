import { ipcMain, BrowserWindow, nativeTheme } from 'electron'
import { settingsService } from '../services/settings.service'
import { handleValidated, assertString } from '../lib/ipc-validator'
import type { AIProvider, ProviderConfig, ThemeMode } from '../../shared/types'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', async () => {
    return settingsService.getAll()
  })

  ipcMain.handle('settings:getTheme', async () => {
    return settingsService.getTheme()
  })

  ipcMain.handle('settings:getSystemTheme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  handleValidated(
    'settings:setTheme',
    (theme) => assertString(theme, 'theme') as ThemeMode,
    async (theme) => {
      await settingsService.setTheme(theme)
      nativeTheme.themeSource = theme === 'system' ? 'system' : theme
    }
  )

  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('settings:systemThemeChanged', theme)
      }
    })
  })

  handleValidated(
    'settings:get',
    (key) => assertString(key, 'key'),
    async (key) => settingsService.get(key)
  )

  handleValidated(
    'settings:set',
    (key, value) => ({ key: assertString(key, 'key'), value: assertString(value, 'value') }),
    async ({ key, value }) => {
      await settingsService.set(key, value)
    }
  )

  handleValidated(
    'settings:getProviderConfig',
    (provider) => assertString(provider, 'provider') as AIProvider,
    async (provider) => settingsService.getProviderConfig(provider)
  )

  handleValidated(
    'settings:setProviderConfig',
    (provider, config) => ({
      provider: assertString(provider, 'provider') as AIProvider,
      config: config as Partial<ProviderConfig>
    }),
    async ({ provider, config }) => {
      await settingsService.setProviderConfig(provider, config)
    }
  )

  handleValidated(
    'settings:validateApiKey',
    (provider, apiKey) => ({
      provider: assertString(provider, 'provider') as AIProvider,
      apiKey: assertString(apiKey, 'apiKey')
    }),
    async ({ provider, apiKey }) => settingsService.validateApiKey(provider, apiKey)
  )

  handleValidated(
    'settings:fetchOllamaModels',
    (baseUrl) => assertString(baseUrl, 'baseUrl'),
    async (baseUrl) => settingsService.fetchOllamaModels(baseUrl)
  )
}
