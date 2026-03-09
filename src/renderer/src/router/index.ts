import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import ChatView from '@renderer/views/ChatView.vue'
import ConnectionsView from '@renderer/views/ConnectionsView.vue'
import SettingsView from '@renderer/views/SettingsView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/chat'
  },
  {
    path: '/chat',
    name: 'chat',
    component: ChatView,
    meta: { title: 'Chat' }
  },
  {
    path: '/chat/:conversationId',
    name: 'chat-conversation',
    component: ChatView,
    meta: { title: 'Chat' }
  },
  {
    path: '/connections',
    name: 'connections',
    component: ConnectionsView,
    meta: { title: 'Connections' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: { title: 'Settings' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/chat'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
