import { ipcMain, shell } from 'electron'
import { readFile } from 'fs/promises'
import { dirname } from 'path'
import log from 'electron-log/main'
import { handleValidated, assertOptionalNumber } from '../lib/ipc-validator'

export function registerLogsIpc(): void {
  ipcMain.handle('logs:getLogPath', () => {
    return log.transports.file.getFile().path
  })

  handleValidated(
    'logs:getRecentLogs',
    (lines) => assertOptionalNumber(lines, 'lines') ?? 500,
    async (lines) => {
      try {
        const path = log.transports.file.getFile().path
        const content = await readFile(path, 'utf-8')
        const allLines = content.split('\n')
        const lastLines = allLines.slice(-lines)
        return lastLines.join('\n')
      } catch (err) {
        log.error('[Logs] Failed to read log file:', err)
        return ''
      }
    }
  )

  ipcMain.handle('logs:openLogFolder', async () => {
    const path = log.transports.file.getFile().path
    const dir = dirname(path)
    await shell.openPath(dir)
  })
}
