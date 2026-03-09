import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AIProvider, ProviderConfig, ValidationResult } from '../../../shared/types'
import { DEFAULT_PROVIDER_CONFIGS, AI_PROVIDERS, PROVIDER_LABELS } from '../../../shared/types'

export { AI_PROVIDERS, PROVIDER_LABELS }
export type { AIProvider, ProviderConfig, ValidationResult }

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<'dark' | 'light'>('dark')
  const activeProvider = ref<AIProvider>('ollama')
  const activeModel = ref('llama3.2')
  const providerConfigs = ref<Record<AIProvider, ProviderConfig>>(
    structuredClone(DEFAULT_PROVIDER_CONFIGS)
  )

  const activeProviderConfig = computed(() => providerConfigs.value[activeProvider.value])

  function isProviderConfigured(provider: AIProvider): boolean {
    const config = providerConfigs.value[provider]
    if (provider === 'ollama') return Boolean(config.baseUrl)
    return Boolean(config.apiKey)
  }

  function applyTheme(value: 'dark' | 'light'): void {
    theme.value = value
    document.documentElement.classList.toggle('dark', value === 'dark')
  }

  async function loadSettings(): Promise<void> {
    try {
      const settings = await window.api.settings.getAll()
      applyTheme(settings.theme)
      activeProvider.value = settings.activeProvider
      activeModel.value = settings.activeModel
      providerConfigs.value = settings.providerConfigs
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error)
      applyTheme('dark')
    }
  }

  async function toggleTheme(): Promise<void> {
    const newTheme = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme(newTheme)
    try {
      await window.api.settings.setTheme(newTheme)
    } catch (error) {
      console.error('[Settings] Failed to persist theme:', error)
    }
  }

  async function setProvider(provider: AIProvider): Promise<void> {
    activeProvider.value = provider
    const config = providerConfigs.value[provider]
    activeModel.value = config.selectedModel || config.models[0] || ''
    try {
      await window.api.settings.set('activeProvider', provider)
      await window.api.settings.set('activeModel', activeModel.value)
    } catch (error) {
      console.error('[Settings] Failed to persist provider:', error)
    }
  }

  async function setModel(model: string): Promise<void> {
    activeModel.value = model
    providerConfigs.value[activeProvider.value].selectedModel = model
    try {
      await window.api.settings.set('activeModel', model)
      await window.api.settings.setProviderConfig(activeProvider.value, {
        selectedModel: model
      })
    } catch (error) {
      console.error('[Settings] Failed to persist model:', error)
    }
  }

  async function updateProviderConfig(
    provider: AIProvider,
    config: Partial<ProviderConfig>
  ): Promise<void> {
    providerConfigs.value[provider] = { ...providerConfigs.value[provider], ...config }
    try {
      await window.api.settings.setProviderConfig(provider, config)
    } catch (error) {
      console.error('[Settings] Failed to persist provider config:', error)
    }
  }

  async function validateApiKey(provider: AIProvider, apiKey?: string): Promise<ValidationResult> {
    const key = apiKey || providerConfigs.value[provider].apiKey || ''
    if (!key && provider !== 'ollama') {
      return { valid: false, message: 'API key is required' }
    }
    try {
      return await window.api.settings.validateApiKey(provider, key)
    } catch (error) {
      console.error('[Settings] Validation failed:', error)
      return { valid: false, message: 'Validation request failed' }
    }
  }

  async function refreshOllamaModels(): Promise<string[]> {
    const config = providerConfigs.value.ollama
    const baseUrl = config.baseUrl || 'http://localhost:11434'
    try {
      const models = await window.api.settings.fetchOllamaModels(baseUrl)
      if (models.length > 0) {
        const merged = [...new Set([...models, ...config.models])]
        providerConfigs.value.ollama.models = merged
        await window.api.settings.setProviderConfig('ollama', { models: merged })
      }
      return models
    } catch (error) {
      console.error('[Settings] Failed to fetch Ollama models:', error)
      return []
    }
  }

  return {
    theme,
    activeProvider,
    activeModel,
    providerConfigs,
    activeProviderConfig,
    isProviderConfigured,
    loadSettings,
    toggleTheme,
    setProvider,
    setModel,
    updateProviderConfig,
    validateApiKey,
    refreshOllamaModels
  }
})
