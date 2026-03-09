import { ipcMain, dialog } from 'electron'
import { exportService, sanitizeExportError } from '../services/export.service'

export function registerExportIpc(): void {
  ipcMain.handle(
    'export:showSaveDialog',
    async (
      _event,
      options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }
    ) => {
      const result = await dialog.showSaveDialog({
        defaultPath: options?.defaultPath,
        filters: options?.filters ?? [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (result.canceled || !result.filePath) return null
      return result.filePath
    }
  )

  ipcMain.handle(
    'export:csv',
    async (_event, filePath: string, columns: string[], jsonRows: string) => {
      try {
        const parsed = JSON.parse(jsonRows)
        if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'object' || r === null)) {
          throw new Error('Invalid export data')
        }
        const rows = parsed as Record<string, unknown>[]
        await exportService.exportCsv(filePath, columns, rows)
      } catch (error) {
        throw new Error(sanitizeExportError(error))
      }
    }
  )

  ipcMain.handle(
    'export:excel',
    async (_event, filePath: string, columns: string[], jsonRows: string) => {
      try {
        const parsed = JSON.parse(jsonRows)
        if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'object' || r === null)) {
          throw new Error('Invalid export data')
        }
        const rows = parsed as Record<string, unknown>[]
        await exportService.exportExcel(filePath, columns, rows)
      } catch (error) {
        throw new Error(sanitizeExportError(error))
      }
    }
  )
}
