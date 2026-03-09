import { ipcRenderer } from 'electron'

export const exportApi = {
  showSaveDialog: (optionsJson: string): Promise<string | null> =>
    ipcRenderer.invoke('export:showSaveDialog', optionsJson),

  exportCsv: (payload: string): Promise<void> =>
    ipcRenderer.invoke('export:csv', payload),

  exportExcel: (payload: string): Promise<void> =>
    ipcRenderer.invoke('export:excel', payload),

  exportExcelReport: (payload: string): Promise<void> =>
    ipcRenderer.invoke('export:excelReport', payload)
}
