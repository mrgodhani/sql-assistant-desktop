import { ipcRenderer } from 'electron'
import type { SchemaIntrospectionResult } from '../../shared/types'

export const schemaApi = {
  introspect: (connectionId: string): Promise<SchemaIntrospectionResult> =>
    ipcRenderer.invoke('schema:introspect', connectionId),

  refresh: (connectionId: string): Promise<SchemaIntrospectionResult> =>
    ipcRenderer.invoke('schema:refresh', connectionId),

  getContext: (connectionId: string): Promise<string> =>
    ipcRenderer.invoke('schema:getContext', connectionId)
}
