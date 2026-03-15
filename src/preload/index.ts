import { contextBridge } from 'electron'
import './electron-bridge'
import { settingsApi } from './api/settings.api'
import { connectionsApi } from './api/connections.api'
import { schemaApi } from './api/schema.api'
import { aiApi } from './api/ai.api'
import { dbApi } from './api/db.api'
import { conversationApi } from './api/conversation.api'
import { exportApi } from './api/export.api'
import { logsApi } from './api/logs.api'
import { platformApi } from './api/platform.api'
import { explainApi } from './api/explain.api'
import { schemaAgentApi } from './api/schema-agent.api'
import { updaterApi } from './api/updater.api'

const api = {
  settings: settingsApi
}

try {
  contextBridge.exposeInMainWorld('api', api)
  contextBridge.exposeInMainWorld('connectionsApi', connectionsApi)
  contextBridge.exposeInMainWorld('schemaApi', schemaApi)
  contextBridge.exposeInMainWorld('aiApi', aiApi)
  contextBridge.exposeInMainWorld('dbApi', dbApi)
  contextBridge.exposeInMainWorld('conversationApi', conversationApi)
  contextBridge.exposeInMainWorld('exportApi', exportApi)
  contextBridge.exposeInMainWorld('logsApi', logsApi)
  contextBridge.exposeInMainWorld('platformApi', platformApi)
  contextBridge.exposeInMainWorld('explainApi', explainApi)
  contextBridge.exposeInMainWorld('schemaAgentApi', schemaAgentApi)
  contextBridge.exposeInMainWorld('updaterApi', updaterApi)
} catch (error) {
  console.error('[Preload] Failed to expose APIs:', error)
}
