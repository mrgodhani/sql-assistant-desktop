import { writeFile, readFile } from 'fs/promises'
import { resolve } from 'path'
import ExcelJS from 'exceljs'
import type { ReportExportOptions } from '../../shared/types'

const MAX_ROWS = 100_000
const CHART_IMAGE_MAX_BYTES = 2 * 1024 * 1024

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '')
  if (/^[=+\-@]/.test(str)) return "'" + str.replace(/'/g, "''")
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

/** Converts any value to Excel-safe primitive (string, number, boolean, null, Date) */
function toExcelCellValue(value: unknown): string | number | boolean | null | Date {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value
  if (typeof value === 'object') return String(value)
  return String(value)
}

function sanitizeExportError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (/EACCES|permission denied/i.test(msg)) return 'Export failed. Check file permissions.'
  if (/ENOSPC|disk full/i.test(msg)) return 'Export failed. Disk is full.'
  if (/ENOENT|not found/i.test(msg)) return 'Export failed. Invalid file path.'
  if (/Invalid export data|Invalid file path/i.test(msg)) return msg
  if (/JSON|parse|Unexpected/i.test(msg)) return 'Export failed. Invalid data format.'
  return `Export failed: ${msg}`
}

function validatePath(filePath: unknown): string | null {
  if (typeof filePath !== 'string' || !filePath.trim()) return null
  const resolved = resolve(filePath.trim())
  if (resolved.includes('..')) return null
  return resolved
}

function validatePayload(
  columns: unknown,
  rows: unknown
): { columns: string[]; rows: Record<string, unknown>[] } | null {
  if (!Array.isArray(columns) || columns.some((c) => typeof c !== 'string')) return null
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) return null
  return { columns: columns as string[], rows: rows as Record<string, unknown>[] }
}

export class ExportService {
  async exportCsv(filePath: string, columns: string[], rows: Record<string, unknown>[]): Promise<void> {
    const path = validatePath(filePath)
    if (!path) throw new Error('Invalid file path')

    const payload = validatePayload(columns, rows)
    if (!payload) throw new Error('Invalid export data')

    const { columns: cols, rows: rws } = payload
    const lines: string[] = [cols.map(escapeCsvCell).join(',')]
    for (const row of rws) {
      const cells = cols.map((col) => escapeCsvCell(row[col]))
      lines.push(cells.join(','))
    }
    const csv = '\uFEFF' + lines.join('\n')
    await writeFile(path, csv, 'utf-8')
  }

  async exportExcel(
    filePath: string,
    columns: string[],
    rows: Record<string, unknown>[]
  ): Promise<void> {
    const path = validatePath(filePath)
    if (!path) throw new Error('Invalid file path')

    const payload = validatePayload(columns, rows)
    if (!payload) throw new Error('Invalid export data')

    const { columns: cols, rows: rws } = payload
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] })

    sheet.addRow(cols)
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }

    for (const row of rws) {
      const rowData = cols.map((col) => toExcelCellValue(row[col]))
      sheet.addRow(rowData)
    }

    await workbook.xlsx.writeFile(path)
  }

  async exportExcelReport(
    filePath: string,
    columns: string[],
    rows: Record<string, unknown>[],
    options: ReportExportOptions
  ): Promise<void> {
    const path = validatePath(filePath)
    if (!path) throw new Error('Invalid file path')

    const payload = validatePayload(columns, rows)
    if (!payload) throw new Error('Invalid export data')

    const { columns: cols, rows: rws } = payload
    const title = (options.title?.trim() || 'Report').slice(0, 200)
    const includeChart = options.includeChart && options.chartImageBase64

    if (includeChart && options.chartImageBase64) {
      const base64 = options.chartImageBase64.replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(base64, 'base64')
      if (buf.length > CHART_IMAGE_MAX_BYTES) {
        throw new Error('Chart image too large.')
      }
    }

    const workbook = new ExcelJS.Workbook()
    const dataSheet = workbook.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 4 }] })

    // Header row 1: logo placeholder, title, date
    const headerRow = dataSheet.addRow([])
    dataSheet.mergeCells('B1:E1')
    headerRow.getCell(2)!.value = title
    headerRow.getCell(2)!.font = { bold: true, size: 14 }
    dataSheet.getCell('F1').value = new Date().toLocaleDateString()
    dataSheet.addRow([])

    // Data
    dataSheet.addRow(cols)
    const colHeaderRow = dataSheet.getRow(3)
    colHeaderRow.font = { bold: true }
    for (const row of rws) {
      dataSheet.addRow(cols.map((col) => toExcelCellValue(row[col])))
    }

    // Page setup and footer
    dataSheet.pageSetup.printArea = `A1:F${rws.length + 4}`
    dataSheet.headerFooter.firstFooter = `Generated on ${new Date().toLocaleDateString()}`

    // Logo (optional) - add before chart sheet so data sheet is complete
    if (options.logoPath) {
      try {
        const logoBuf = await readFile(options.logoPath)
        if (logoBuf.length <= 500 * 1024) {
          const ext = options.logoPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
          const logoId = workbook.addImage({
            // @ts-expect-error - Node 22+ Buffer type differs from ExcelJS expectation
            buffer: Buffer.from(logoBuf),
            extension: ext
          })
          dataSheet.addImage(logoId, 'A1:A2')
        }
      } catch {
        // Skip logo on error
      }
    }

    if (includeChart && options.chartImageBase64) {
      const chartSheet = workbook.addWorksheet('Chart')
      chartSheet.addRow([])
      chartSheet.getCell('B1').value = title
      chartSheet.getCell('B1').font = { bold: true, size: 14 }
      chartSheet.getCell('F1').value = new Date().toLocaleDateString()

      const base64 = options.chartImageBase64.replace(/^data:image\/\w+;base64,/, '')
      const imageId = workbook.addImage({
        // @ts-expect-error - Node 22+ Buffer type differs from ExcelJS expectation
        buffer: Buffer.from(base64, 'base64'),
        extension: 'png'
      })
      chartSheet.addImage(imageId, 'A3:I20')
      chartSheet.headerFooter.firstFooter = `Generated on ${new Date().toLocaleDateString()}`
    }

    await workbook.xlsx.writeFile(path)
  }
}

export const exportService = new ExportService()

export { sanitizeExportError, validatePath, validatePayload }
