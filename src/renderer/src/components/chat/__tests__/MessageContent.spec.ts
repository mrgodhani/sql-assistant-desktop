import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import MessageContent from '../MessageContent.vue'

vi.mock('electron-log/renderer', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const TRUNCATE_LENGTH = 250
const COLLAPSE_THRESHOLD = 350

function makeLongProse(length: number): string {
  const head = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(5).slice(0, TRUNCATE_LENGTH)
  const tail = ' [EXPANDED_ONLY_TAIL] '.repeat(20).slice(0, length - TRUNCATE_LENGTH)
  return head + tail
}

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

  it('expand/collapse long prose: collapsed shows truncated text and Show more, expand shows full content and Show less', async () => {
    const longContent = makeLongProse(400)
    const wrapper = mount(MessageContent, {
      props: {
        message: { role: 'assistant', content: longContent },
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

    // Collapsed: truncated text (~250 chars + ellipsis)
    const truncated = longContent.slice(0, TRUNCATE_LENGTH) + '...'
    expect(wrapper.text()).toContain(truncated)
    expect(wrapper.text()).not.toContain('[EXPANDED_ONLY_TAIL]')

    // Show more button visible
    const showMoreBtn = wrapper.findAll('button').find((b) => b.text().includes('Show more'))
    expect(showMoreBtn?.exists()).toBe(true)

    // Click Show more -> expanded
    await showMoreBtn!.trigger('click')
    expect(wrapper.text()).toContain(longContent)
    const showLessBtn = wrapper.findAll('button').find((b) => b.text().includes('Show less'))
    expect(showLessBtn?.exists()).toBe(true)

    // Click Show less -> collapsed again
    await showLessBtn!.trigger('click')
    expect(wrapper.text()).toContain(truncated)
    expect(wrapper.findAll('button').find((b) => b.text().includes('Show more'))?.exists()).toBe(true)
  })
})
