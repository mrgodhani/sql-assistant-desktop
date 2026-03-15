import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import ChatView from '@renderer/views/ChatView.vue'
import ConnectionsView from '@renderer/views/ConnectionsView.vue'
import SchemaView from '@renderer/views/SchemaView.vue'
import SettingsView from '@renderer/views/SettingsView.vue'
import SchemaDesignerView from '@renderer/views/SchemaDesignerView.vue'

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
    path: '/schema',
    name: 'schema',
    component: SchemaView,
    meta: { title: 'Schema' }
  },
  {
    path: '/schema/:connectionId',
    name: 'schema-connection',
    component: SchemaView,
    meta: { title: 'Schema' }
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
    path: '/schema-designer',
    name: 'schema-designer',
    component: SchemaDesignerView,
    meta: { title: 'Schema Designer' }
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
