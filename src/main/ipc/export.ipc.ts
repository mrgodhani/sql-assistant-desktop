import { ipcMain, dialog } from 'electron'
import { exportService, sanitizeExportError } from '../services/export.service'

export function registerExportIpc(): void {
  ipcMain.handle('export:showOpenDialog', async (_event, optionsJson: string) => {
    const options = JSON.parse(optionsJson || '{}') as {
      filters?: { name: string; extensions: string[] }[]
    }
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters ?? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }]
    })
    if (result.canceled || !result.filePaths?.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('export:showSaveDialog', async (_event, optionsJson: string) => {
    const options = JSON.parse(optionsJson || '{}') as {
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
    }
    const result = await dialog.showSaveDialog({
      defaultPath: options?.defaultPath,
      filters: options?.filters ?? [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('export:csv', async (_event, payload: string) => {
    try {
      const { path, columns, jsonRows } = JSON.parse(payload) as {
        path: string
        columns: string[]
        jsonRows: string
      }
      const parsed = JSON.parse(jsonRows)
      if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'object' || r === null)) {
        throw new Error('Invalid export data')
      }
      const rows = parsed as Record<string, unknown>[]
      await exportService.exportCsv(path, columns, rows)
    } catch (error) {
      throw new Error(sanitizeExportError(error))
    }
  })

  ipcMain.handle('export:excel', async (_event, payload: string) => {
    try {
      const { path, columns, jsonRows } = JSON.parse(payload) as {
        path: string
        columns: string[]
        jsonRows: string
      }
      const parsed = JSON.parse(jsonRows)
      if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'object' || r === null)) {
        throw new Error('Invalid export data')
      }
      const rows = parsed as Record<string, unknown>[]
      await exportService.exportExcel(path, columns, rows)
    } catch (error) {
      console.error('[export:excel]', error)
      throw new Error(sanitizeExportError(error))
    }
  })

  ipcMain.handle('export:excelReport', async (_event, payload: string) => {
    try {
      const { path, columns, jsonRows, reportOptions } = JSON.parse(payload) as {
        path: string
        columns: string[]
        jsonRows: string
        reportOptions: {
          title: string
          logoPath?: string
          includeChart: boolean
          chartImageBase64?: string
        }
      }
      const parsed = JSON.parse(jsonRows)
      if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'object' || r === null)) {
        throw new Error('Invalid export data')
      }
      const rows = parsed as Record<string, unknown>[]
      await exportService.exportExcelReport(path, columns, rows, reportOptions)
    } catch (error) {
      throw new Error(sanitizeExportError(error))
    }
  })
}
