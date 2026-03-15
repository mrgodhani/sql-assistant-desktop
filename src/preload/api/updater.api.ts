import { ipcRenderer } from 'electron'

export const updaterApi = {
  onUpdateDownloaded: (callback: (version: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, version: string): void => callback(version)
    ipcRenderer.on('app-update-downloaded', handler)
    return (): void => {
      ipcRenderer.removeListener('app-update-downloaded', handler)
    }
  },
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install')
}
