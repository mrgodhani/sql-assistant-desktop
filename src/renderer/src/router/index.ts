import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import ChatView from '@renderer/views/ChatView.vue'
import SchemaView from '@renderer/views/SchemaView.vue'

const DesignerView = () => import('@renderer/views/DesignerView.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/chat' },
  { path: '/chat', name: 'chat', component: ChatView, meta: { title: 'Chat' } },
  { path: '/chat/:conversationId', name: 'chat-conversation', component: ChatView, meta: { title: 'Chat' } },
  { path: '/schema', name: 'schema', component: SchemaView, meta: { title: 'Schema' } },
  { path: '/schema/:connectionId', name: 'schema-connection', component: SchemaView, meta: { title: 'Schema' } },
  { path: '/schema-designer', name: 'schema-designer', component: DesignerView, meta: { title: 'Designer' } },
  { path: '/:pathMatch(.*)*', redirect: '/chat' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
