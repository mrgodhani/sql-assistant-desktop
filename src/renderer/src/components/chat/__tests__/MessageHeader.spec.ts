import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageHeader from '../MessageHeader.vue'

describe('MessageHeader', () => {
  it('renders user avatar and label (expect "You")', () => {
    const wrapper = mount(MessageHeader, {
      props: { role: 'user' }
    })
    expect(wrapper.text()).toContain('You')
    expect(wrapper.find('[class*="bg-primary"]').exists()).toBe(true)
  })

  it('renders assistant avatar and label (expect "Assistant")', () => {
    const wrapper = mount(MessageHeader, {
      props: { role: 'assistant' }
    })
    expect(wrapper.text()).toContain('Assistant')
    expect(wrapper.find('[class*="bg-muted"]').exists()).toBe(true)
  })
})
