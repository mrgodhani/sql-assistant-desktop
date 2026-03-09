import log from 'electron-log/renderer'
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { settingsApi } from './api/settings.api'
import { connectionsApi } from './api/connections.api'
import { schemaApi } from './api/schema.api'
import { aiApi } from './api/ai.api'
import { dbApi } from './api/db.api'
import { conversationApi } from './api/conversation.api'
import { exportApi } from './api/export.api'
import { logsApi } from './api/logs.api'

const api = {
  settings: settingsApi
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('connectionsApi', connectionsApi)
    contextBridge.exposeInMainWorld('schemaApi', schemaApi)
    contextBridge.exposeInMainWorld('aiApi', aiApi)
    contextBridge.exposeInMainWorld('dbApi', dbApi)
    contextBridge.exposeInMainWorld('conversationApi', conversationApi)
    contextBridge.exposeInMainWorld('exportApi', exportApi)
    contextBridge.exposeInMainWorld('logsApi', logsApi)
  } catch (error) {
    log.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.connectionsApi = connectionsApi
  // @ts-ignore (define in dts)
  window.schemaApi = schemaApi
  // @ts-ignore (define in dts)
  window.aiApi = aiApi
  // @ts-ignore (define in dts)
  window.dbApi = dbApi
  // @ts-ignore (define in dts)
  window.conversationApi = conversationApi
  // @ts-ignore (define in dts)
  window.exportApi = exportApi
  // @ts-ignore (define in dts)
  window.logsApi = logsApi
}
