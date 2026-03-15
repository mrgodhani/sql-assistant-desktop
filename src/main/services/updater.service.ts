import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log/main'
import { is } from '@electron-toolkit/utils'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

export function initAutoUpdater(): void {
  if (is.dev) {
    log.info('[Updater] Skipping auto-update in dev mode')
    return
  }

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    log.info(`[Updater] Update available: v${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] No update available')
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info(`[Updater] Download progress: ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[Updater] Update downloaded: v${info.version}`)
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('app-update-downloaded', info.version)
    }
  })

  autoUpdater.on('error', (error) => {
    log.error('[Updater] Error:', error.message)
  })

  autoUpdater.checkForUpdates().catch((err) => {
    log.error('[Updater] Initial check failed:', err)
  })

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[Updater] Periodic check failed:', err)
    })
  }, CHECK_INTERVAL_MS)
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
