import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AIBehaviorSettings from '../AIBehaviorSettings.vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'

vi.mock('electron-log/renderer', () => ({ default: { error: vi.fn(), info: vi.fn() } }))

vi.stubGlobal('window', {
  api: {
    settings: {
      getAll: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      setTheme: vi.fn(),
      setProviderConfig: vi.fn(),
      getSystemTheme: vi.fn().mockResolvedValue('dark'),
      onSystemThemeChange: vi.fn(),
      validateApiKey: vi.fn()
    }
  },
  aiApi: { listModels: vi.fn().mockResolvedValue([]) }
})

describe('AIBehaviorSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders slider with default temperature', () => {
    const wrapper = mount(AIBehaviorSettings)
    const slider = wrapper.find('[data-testid="temperature-slider"]')
    expect(slider.exists()).toBe(true)
  })

  it('displays numeric value to 2 decimal places', () => {
    const wrapper = mount(AIBehaviorSettings)
    expect(wrapper.find('[data-testid="temperature-value"]').text()).toBe('0.30')
  })

  it('shows Balanced hint at default temperature (0.3)', () => {
    const wrapper = mount(AIBehaviorSettings)
    expect(wrapper.find('[data-testid="temperature-hint"]').text()).toContain('Balanced')
  })

  it('calls setTemperature on change event', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'setTemperature').mockResolvedValue()
    const wrapper = mount(AIBehaviorSettings)
    const slider = wrapper.find('[data-testid="temperature-slider"]')
    const el = slider.element as HTMLInputElement
    Object.defineProperty(el, 'value', { value: '0.7', configurable: true })
    // happy-dom + @vue/test-utils trigger('change') throws (SupportedEventInterface)
    el.dispatchEvent(new Event('change', { bubbles: true }))
    expect(spy).toHaveBeenCalledWith(0.7)
  })
})
