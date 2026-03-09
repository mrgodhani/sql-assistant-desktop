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
})
