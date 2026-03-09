import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import ExcelJS from 'exceljs'

const MAX_ROWS = 100_000

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '')
  if (/^[=+\-@]/.test(str)) return "'" + str.replace(/'/g, "''")
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

function sanitizeExportError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (/EACCES|permission denied/i.test(msg)) return 'Export failed. Check file permissions.'
  if (/ENOSPC|disk full/i.test(msg)) return 'Export failed. Disk is full.'
  if (/ENOENT|not found/i.test(msg)) return 'Export failed. Invalid file path.'
  return 'Export failed. Please try again.'
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
      const rowData = cols.map((col) => row[col])
      sheet.addRow(rowData)
    }

    await workbook.xlsx.writeFile(path)
  }
}

export const exportService = new ExportService()

export { sanitizeExportError, validatePath, validatePayload }
