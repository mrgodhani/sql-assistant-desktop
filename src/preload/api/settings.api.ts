import { ipcRenderer } from 'electron'
import type { AIProvider, AppSettings, ProviderConfig, ValidationResult } from '../../shared/types'

export const settingsApi = {
  getAll: (): Promise<AppSettings> => ipcRenderer.invoke('settings:getAll'),
  getTheme: (): Promise<'dark' | 'light'> => ipcRenderer.invoke('settings:getTheme'),
  setTheme: (theme: 'dark' | 'light'): Promise<void> =>
    ipcRenderer.invoke('settings:setTheme', theme),
  get: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
  set: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),
  getProviderConfig: (provider: AIProvider): Promise<ProviderConfig> =>
    ipcRenderer.invoke('settings:getProviderConfig', provider),
  setProviderConfig: (provider: AIProvider, config: Partial<ProviderConfig>): Promise<void> =>
    ipcRenderer.invoke('settings:setProviderConfig', provider, config),
  validateApiKey: (provider: AIProvider, apiKey: string): Promise<ValidationResult> =>
    ipcRenderer.invoke('settings:validateApiKey', provider, apiKey),
  fetchOllamaModels: (baseUrl: string): Promise<string[]> =>
    ipcRenderer.invoke('settings:fetchOllamaModels', baseUrl)
}
