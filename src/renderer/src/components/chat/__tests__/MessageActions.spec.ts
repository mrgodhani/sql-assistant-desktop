import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageActions from '../MessageActions.vue'

describe('MessageActions', () => {
  it('emits copy when Copy clicked', async () => {
    const wrapper = mount(MessageActions, {
      props: { role: 'user' }
    })
    await wrapper.find('[aria-label="Copy"]').trigger('click')
    expect(wrapper.emitted('copy')).toHaveLength(1)
  })

  it('shows "Copied" when copied prop is true', () => {
    const wrapper = mount(MessageActions, {
      props: { role: 'user', copied: true }
    })
    expect(wrapper.find('[aria-label="Copied"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Copied')
  })

  it('shows Copy icon when copied prop is false', () => {
    const wrapper = mount(MessageActions, {
      props: { role: 'user', copied: false }
    })
    expect(wrapper.find('[aria-label="Copy"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Copied')
  })

  it('shows Edit for user only', () => {
    const userWrapper = mount(MessageActions, {
      props: { role: 'user' }
    })
    expect(userWrapper.find('[aria-label="Edit"]').exists()).toBe(true)

    const assistantWrapper = mount(MessageActions, {
      props: { role: 'assistant' }
    })
    expect(assistantWrapper.find('[aria-label="Edit"]').exists()).toBe(false)
  })

  it('shows Regenerate for assistant only', () => {
    const assistantWrapper = mount(MessageActions, {
      props: { role: 'assistant' }
    })
    expect(assistantWrapper.find('[aria-label="Regenerate"]').exists()).toBe(true)

    const userWrapper = mount(MessageActions, {
      props: { role: 'user' }
    })
    expect(userWrapper.find('[aria-label="Regenerate"]').exists()).toBe(false)
  })

  it('Regenerate disabled when isStreaming is true', () => {
    const wrapper = mount(MessageActions, {
      props: { role: 'assistant', isStreaming: true }
    })
    const regenerateBtn = wrapper.find('[aria-label="Regenerate"]')
    expect(regenerateBtn.exists()).toBe(true)
    expect(regenerateBtn.attributes('disabled')).toBeDefined()
  })

  it('emits regenerate when Regenerate clicked and not streaming', async () => {
    const wrapper = mount(MessageActions, {
      props: { role: 'assistant', isStreaming: false }
    })
    await wrapper.find('[aria-label="Regenerate"]').trigger('click')
    expect(wrapper.emitted('regenerate')).toHaveLength(1)
  })

  it('emits edit when Edit clicked', async () => {
    const wrapper = mount(MessageActions, {
      props: { role: 'user' }
    })
    await wrapper.find('[aria-label="Edit"]').trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
