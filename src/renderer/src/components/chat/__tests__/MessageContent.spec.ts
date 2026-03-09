import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import MessageContent from '../MessageContent.vue'

vi.mock('electron-log/renderer', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

describe('MessageContent', () => {
  it('renders user message content', () => {
    const wrapper = mount(MessageContent, {
      props: {
        message: { role: 'user', content: 'Hello' },
        messageIndex: 0,
        isStreaming: false
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          SqlCodeBlock: true,
          ResultsPanel: true
        }
      }
    })
    expect(wrapper.text()).toContain('Hello')
  })
})
