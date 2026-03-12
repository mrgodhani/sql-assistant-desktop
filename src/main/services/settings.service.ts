import { eq } from 'drizzle-orm'
import log from 'electron-log/main'
import { getDatabase, schema } from '../db'
import { encryptionService } from './encryption.service'
import type {
  AIProvider,
  ProviderConfig,
  ThemeMode,
  ValidationResult,
  AppSettings
} from '../../shared/types'
import { DEFAULT_PROVIDER_CONFIGS, AI_PROVIDERS } from '../../shared/types'

function maskKey(key: string): string {
  if (key.length <= 4) return '****'
  return `***...${key.slice(-4)}`
}

export class SettingsService {
  async get(key: string): Promise<string | null> {
    const db = getDatabase()
    const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get()
    return row?.value ?? null
  }

  async set(key: string, value: string, encrypted = false): Promise<void> {
    const db = getDatabase()
    const storedValue = encrypted ? encryptionService.encrypt(value) : value
    db.insert(schema.settings)
      .values({
        key,
        value: storedValue,
        encrypted,
        updatedAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: storedValue, encrypted, updatedAt: new Date().toISOString() }
      })
      .run()
  }

  async getDecrypted(key: string): Promise<string | null> {
    const db = getDatabase()
    const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get()
    if (!row) return null
    return encryptionService.decrypt(row.value, row.encrypted ?? false)
  }

  async getTheme(): Promise<ThemeMode> {
    const theme = await this.get('theme')
    if (theme === 'system' || theme === 'dark' || theme === 'light') return theme
    return 'system'
  }

  async setTheme(theme: ThemeMode): Promise<void> {
    await this.set('theme', theme)
  }

  async getAll(): Promise<AppSettings> {
    const theme = await this.getTheme()
    const activeProvider = ((await this.get('activeProvider')) as AIProvider) || 'ollama'
    const activeModel =
      (await this.get('activeModel')) || DEFAULT_PROVIDER_CONFIGS[activeProvider].selectedModel

    const providerConfigs = {} as Record<AIProvider, ProviderConfig>
    for (const provider of AI_PROVIDERS) {
      providerConfigs[provider] = await this.getProviderConfig(provider)
    }

    return { theme, activeProvider, activeModel, providerConfigs }
  }

  async getProviderConfig(provider: AIProvider): Promise<ProviderConfig> {
    const raw = await this.getDecrypted(`provider:${provider}`)
    if (!raw) return { ...DEFAULT_PROVIDER_CONFIGS[provider] }

    try {
      const parsed = JSON.parse(raw) as ProviderConfig
      return {
        ...DEFAULT_PROVIDER_CONFIGS[provider],
        ...parsed,
        apiKey: parsed.apiKey || ''
      }
    } catch {
      return { ...DEFAULT_PROVIDER_CONFIGS[provider] }
    }
  }

  async setProviderConfig(provider: AIProvider, config: Partial<ProviderConfig>): Promise<void> {
    const existing = await this.getProviderConfig(provider)
    const merged: ProviderConfig = { ...existing, ...config }
    const hasApiKey = Boolean(merged.apiKey)
    const shouldEncrypt = hasApiKey && provider !== 'ollama'
    await this.set(`provider:${provider}`, JSON.stringify(merged), shouldEncrypt)
  }

  async validateApiKey(provider: AIProvider, apiKey: string): Promise<ValidationResult> {
    const config = await this.getProviderConfig(provider)
    const baseUrl = config.baseUrl || DEFAULT_PROVIDER_CONFIGS[provider].baseUrl || ''
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      let response: Response

      switch (provider) {
        case 'openai':
          response = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal
          })
          break

        case 'anthropic':
          response = await fetch(`${baseUrl}/v1/models`, {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            signal: controller.signal
          })
          break

        case 'google':
          response = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`, {
            signal: controller.signal
          })
          break

        case 'openrouter':
          response = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal
          })
          break

        case 'ollama':
          response = await fetch(`${baseUrl}/api/tags`, {
            signal: controller.signal
          })
          break

        default:
          return { valid: false, message: 'Unknown provider' }
      }

      if (response.ok) {
        log.info(`[Settings] API key validated for ${provider}: ${maskKey(apiKey)}`)
        return { valid: true, message: 'API key is valid' }
      }
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: 'Invalid API key' }
      }
      return { valid: false, message: `Unexpected response (${response.status})` }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { valid: false, message: 'Connection timed out (5s)' }
      }
      return { valid: false, message: 'Connection failed — check your network' }
    } finally {
      clearTimeout(timeout)
    }
  }

  async fetchOllamaModels(baseUrl: string): Promise<string[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal })
      if (!response.ok) return []
      const data = (await response.json()) as { models?: { name: string }[] }
      return data.models?.map((m) => m.name) ?? []
    } catch {
      return []
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const settingsService = new SettingsService()
