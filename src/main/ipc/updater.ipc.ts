import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { quitAndInstall } from '../services/updater.service'

export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:install', () => {
    try {
      quitAndInstall()
    } catch (err) {
      log.error('[Updater] quitAndInstall failed:', err)
      throw err
    }
  })
}
