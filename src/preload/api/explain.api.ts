import { ipcRenderer } from 'electron'

export interface ExplainResult {
  raw: string
  mermaid: string
}

export const explainApi = {
  run: (connectionId: string, sql: string): Promise<ExplainResult> =>
    ipcRenderer.invoke('explain:run', connectionId, sql)
}
