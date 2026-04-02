import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('electron-log/renderer', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}))

import { useSettingsStore } from '../useSettingsStore'
import { DEFAULT_TEMPERATURE, DEFAULT_PROVIDER_CONFIGS } from '../../../../shared/types'

const mockSet = vi.fn().mockResolvedValue(undefined)
const mockGetAll = vi.fn()

vi.stubGlobal('window', {
  api: {
    settings: {
      getAll: mockGetAll,
      set: mockSet,
      setTheme: vi.fn(),
      setProviderConfig: vi.fn(),
      getSystemTheme: vi.fn().mockResolvedValue('dark'),
      onSystemThemeChange: vi.fn(),
      validateApiKey: vi.fn(),
    }
  },
  aiApi: { listModels: vi.fn().mockResolvedValue([]) }
})

const baseSettings = {
  theme: 'dark' as const,
  activeProvider: 'ollama' as const,
  activeModel: 'llama3.2',
  providerConfigs: structuredClone(DEFAULT_PROVIDER_CONFIGS)
}

describe('useSettingsStore — temperature', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('defaults to DEFAULT_TEMPERATURE before loadSettings', () => {
    const store = useSettingsStore()
    expect(store.temperature).toBe(DEFAULT_TEMPERATURE)
  })

  it('loads temperature from getAll()', async () => {
    mockGetAll.mockResolvedValue({ ...baseSettings, temperature: 0.7 })
    const store = useSettingsStore()
    await store.loadSettings()
    expect(store.temperature).toBe(0.7)
  })

  it('setTemperature updates store and persists via IPC', async () => {
    mockGetAll.mockResolvedValue({ ...baseSettings, temperature: DEFAULT_TEMPERATURE })
    const store = useSettingsStore()
    await store.loadSettings()
    await store.setTemperature(0.6)
    expect(store.temperature).toBe(0.6)
    expect(mockSet).toHaveBeenCalledWith('temperature', '0.6')
  })
})
