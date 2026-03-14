import { app, BrowserWindow } from 'electron'

export function enforceSingleInstance(): boolean {
  const gotLock = app.requestSingleInstanceLock()

  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', () => {
    // getAllWindows returns windows in creation order; index 0 is the main window
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  return true
}
