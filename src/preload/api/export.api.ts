import { ipcRenderer } from 'electron'

export const exportApi = {
  showSaveDialog: (options?: {
    defaultPath?: string
    filters?: { name: string; extensions: string[] }[]
  }): Promise<string | null> => ipcRenderer.invoke('export:showSaveDialog', options ?? {}),

  exportCsv: (
    filePath: string,
    columns: string[],
    rows: Record<string, unknown>[]
  ): Promise<void> => ipcRenderer.invoke('export:csv', filePath, columns, rows),

  exportExcel: (
    filePath: string,
    columns: string[],
    rows: Record<string, unknown>[]
  ): Promise<void> => ipcRenderer.invoke('export:excel', filePath, columns, rows)
}
