import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('dagre', () => ({
  default: {
    graphlib: {
      Graph: class {
        setDefaultEdgeLabel = vi.fn()
        setGraph = vi.fn()
        setNode = vi.fn()
        setEdge = vi.fn()
        node = (): { x: number; y: number; height: number } => ({ x: 0, y: 0, height: 80 })
      }
    },
    layout: vi.fn()
  }
}))

const mockGenerateFromPrompt = vi.fn()
vi.mock('@renderer/stores/useDesignerStore', () => ({
  useDesignerStore: () => ({
    generating: false,
    generateError: null,
    generateFromPrompt: mockGenerateFromPrompt,
    tables: []
  })
}))

vi.mock('@/components/ui/button', () => ({
  Button: {
    props: ['disabled'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  }
}))
vi.mock('@renderer/components/shared/LoadingSpinner.vue', () => ({
  default: { template: '<span data-testid="spinner" />' }
}))
vi.mock('lucide-vue-next', () => ({ Sparkles: { template: '<span />' } }))

import DesignerNLPanel from '../DesignerNLPanel.vue'

describe('DesignerNLPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGenerateFromPrompt.mockReset()
  })

  it('renders textarea with placeholder text', () => {
    const wrapper = mount(DesignerNLPanel)
    const textarea = wrapper.find('[data-testid="nl-textarea"]')
    expect(textarea.exists()).toBe(true)
    expect(textarea.attributes('placeholder')).toContain('Describe your schema')
  })

  it('generate button is disabled when textarea is empty', () => {
    const wrapper = mount(DesignerNLPanel)
    const btn = wrapper.find('[data-testid="generate-button"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('generate button is enabled when textarea has text', async () => {
    const wrapper = mount(DesignerNLPanel)
    const textarea = wrapper.find('[data-testid="nl-textarea"]')
    await textarea.setValue('A blog with users')
    const btn = wrapper.find('[data-testid="generate-button"]')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('calls store.generateFromPrompt with textarea value on button click', async () => {
    mockGenerateFromPrompt.mockResolvedValue(undefined)
    const wrapper = mount(DesignerNLPanel)
    await wrapper.find('[data-testid="nl-textarea"]').setValue('A blog with users')
    await wrapper.find('[data-testid="generate-button"]').trigger('click')
    await flushPromises()
    expect(mockGenerateFromPrompt).toHaveBeenCalledWith('A blog with users')
  })

  it('Cmd+Enter in textarea triggers generateFromPrompt', async () => {
    mockGenerateFromPrompt.mockResolvedValue(undefined)
    const wrapper = mount(DesignerNLPanel)
    await wrapper.find('[data-testid="nl-textarea"]').setValue('A blog')
    await wrapper.find('[data-testid="nl-textarea"]').trigger('keydown', { metaKey: true, key: 'Enter' })
    await flushPromises()
    expect(mockGenerateFromPrompt).toHaveBeenCalledWith('A blog')
  })

  it('does not show error when generateError is null', () => {
    const wrapper = mount(DesignerNLPanel)
    expect(wrapper.find('[data-testid="generate-error"]').exists()).toBe(false)
  })

  it('clicking a history chip populates the textarea', async () => {
    mockGenerateFromPrompt.mockResolvedValue(undefined)
    const wrapper = mount(DesignerNLPanel)
    await wrapper.find('[data-testid="nl-textarea"]').setValue('My first prompt')
    await wrapper.find('[data-testid="generate-button"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="nl-textarea"]').setValue('Second prompt')
    await wrapper.find('[data-testid="generate-button"]').trigger('click')
    await flushPromises()

    const chips = wrapper.findAll('[data-testid="history-chip"]')
    expect(chips.length).toBeGreaterThan(0)
    await chips[0].trigger('click')
    const textarea = wrapper.find('[data-testid="nl-textarea"]')
    expect((textarea.element as HTMLTextAreaElement).value).toBeTruthy()
  })
})
