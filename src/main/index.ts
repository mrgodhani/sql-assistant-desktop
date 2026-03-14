import log from 'electron-log/main'
log.initialize()

import { app, shell, BrowserWindow, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initializeDatabase, closeDatabase } from './db'
import { registerAllIpc } from './ipc'
import { createMigrationTables } from './db/migrate'
import { databaseService } from './services/database.service'
import { settingsService } from './services/settings.service'
import { schemaService } from './services/schema.service'
import { aiService } from './services/ai.service'
import { ensureMoveToApplicationsPrompt } from './move-to-applications'
import { enforceSingleInstance } from './enforce-single-instance'

process.on('uncaughtException', (error) => {
  log.error('[Main] Uncaught Exception:', error.message)
  if (is.dev) log.error(error.stack)
  dialog.showErrorBox(
    'Unexpected Error',
    'An unexpected error occurred. The application may need to restart.'
  )
})

process.on('unhandledRejection', (reason) => {
  log.error('[Main] Unhandled Rejection:', reason)
})

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (enforceSingleInstance()) {
  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.sql-assist')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const quittingForRelaunch = await ensureMoveToApplicationsPrompt()
    if (quittingForRelaunch) return

    try {
      initializeDatabase()
      createMigrationTables()
      log.info('[Main] Database initialized at', app.getPath('userData'))
    } catch (error) {
      log.error('[Main] Database initialization failed:', error)
      dialog.showErrorBox(
        'Database Error',
        'Failed to initialize the local database. The application may not function correctly.'
      )
    }

    registerAllIpc()

    const storedTheme = await settingsService.getTheme()
    nativeTheme.themeSource = storedTheme === 'system' ? 'system' : storedTheme

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  aiService.cancelAll()
  schemaService.clearAllCaches()
  await databaseService.disconnectAll()
})

app.on('will-quit', () => {
  closeDatabase()
})
