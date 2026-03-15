import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import AppTopBar from '../AppTopBar.vue'

vi.mock('@renderer/components/chat/ChatToolbar.vue', () => ({
  default: { template: '<div data-testid="chat-toolbar">Chat</div>' }
}))
vi.mock('@renderer/components/layout/ConnectionsToolbar.vue', () => ({
  default: { template: '<div data-testid="connections-toolbar">Connections</div>' }
}))
vi.mock('@renderer/components/layout/SettingsToolbar.vue', () => ({
  default: { template: '<div data-testid="settings-toolbar">Settings</div>' }
}))

const Placeholder = { template: '<div>Placeholder</div>' }
const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/chat', component: Placeholder },
  { path: '/connections', component: Placeholder },
  { path: '/settings', component: Placeholder }
]

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes
  })
}

describe('AppTopBar', () => {
  beforeEach(() => {
    vi.stubGlobal('platformApi', { getPlatform: () => 'darwin' })
  })

  it('renders traffic lights region when platform is darwin', async () => {
    vi.stubGlobal('platformApi', { getPlatform: () => 'darwin' })
    const router = createTestRouter()
    await router.push('/chat')
    const wrapper = mount(AppTopBar, {
      global: {
        plugins: [router]
      }
    })
    expect(wrapper.find('[data-testid="traffic-lights-region"]').exists()).toBe(true)
  })

  it('does not render traffic lights region when platform is win32', async () => {
    vi.stubGlobal('platformApi', { getPlatform: () => 'win32' })
    const router = createTestRouter()
    await router.push('/chat')
    const wrapper = mount(AppTopBar, {
      global: {
        plugins: [router]
      }
    })
    expect(wrapper.find('[data-testid="traffic-lights-region"]').exists()).toBe(false)
  })

  it('renders app top bar', async () => {
    const router = createTestRouter()
    await router.push('/chat')
    const wrapper = mount(AppTopBar, {
      global: {
        plugins: [router]
      }
    })
    expect(wrapper.find('[data-testid="app-topbar"]').exists()).toBe(true)
  })
})
