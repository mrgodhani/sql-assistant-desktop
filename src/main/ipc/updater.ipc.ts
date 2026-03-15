import { ipcMain } from 'electron'
import { quitAndInstall } from '../services/updater.service'

export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:install', () => {
    quitAndInstall()
  })
}
