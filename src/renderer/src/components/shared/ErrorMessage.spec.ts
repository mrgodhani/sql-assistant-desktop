import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorMessage from './ErrorMessage.vue'

describe('ErrorMessage', () => {
  it('renders message', () => {
    const wrapper = mount(ErrorMessage, {
      props: { message: 'Something failed' }
    })
    expect(wrapper.text()).toContain('Something failed')
  })

  it('renders title when provided', () => {
    const wrapper = mount(ErrorMessage, {
      props: { title: 'Error', message: 'Details' }
    })
    expect(wrapper.text()).toContain('Error')
    expect(wrapper.text()).toContain('Details')
  })

  it('shows retry button when retry prop provided', async () => {
    const retry = vi.fn()
    const wrapper = mount(ErrorMessage, {
      props: { message: 'Fail', retry }
    })
    await wrapper.find('[data-testid="error-retry-button"]').trigger('click')
    expect(retry).toHaveBeenCalledOnce()
  })
})
