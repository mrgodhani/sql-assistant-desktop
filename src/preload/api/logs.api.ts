import { ipcRenderer } from 'electron'

export const logsApi = {
  getLogPath: (): Promise<string> => ipcRenderer.invoke('logs:getLogPath'),
  getRecentLogs: (lines?: number): Promise<string> =>
    ipcRenderer.invoke('logs:getRecentLogs', lines),
  openLogFolder: (): Promise<void> => ipcRenderer.invoke('logs:openLogFolder')
}
