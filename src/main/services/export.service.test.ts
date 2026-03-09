/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import ExcelJS from 'exceljs'
import { exportService } from './export.service'
import type { ReportExportOptions } from '../../shared/types'

describe('exportExcelReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sql-assist-export-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates workbook with Data sheet and header/footer', async () => {
    const path = join(tmpDir, 'report.xlsx')
    const columns = ['a', 'b']
    const rows = [{ a: 1, b: 2 }]
    const options: ReportExportOptions = { title: 'My Report', includeChart: false }

    await exportService.exportExcelReport(path, columns, rows, options)

    const buf = readFileSync(path)
    const wb = new ExcelJS.Workbook()
    // @ts-expect-error - Node 22+ Buffer type differs from ExcelJS expectation
    await wb.xlsx.load(buf)
    expect(wb.worksheets.length).toBe(1)
    expect(wb.worksheets[0]?.name).toBe('Data')
    const dataSheet = wb.worksheets[0]!
    expect(dataSheet.getRow(1)?.getCell(2)?.value).toBe('My Report')
    expect(dataSheet.getRow(3)?.getCell(1)?.value).toEqual('a')
  })

  it('adds Chart sheet when includeChart and chartImageBase64 provided', async () => {
    const path = join(tmpDir, 'report2.xlsx')
    const columns = ['x', 'y']
    const rows = [{ x: 'A', y: 10 }]
    const options: ReportExportOptions = {
      title: 'Chart Report',
      includeChart: true,
      chartImageBase64:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    }

    await exportService.exportExcelReport(path, columns, rows, options)

    const buf = readFileSync(path)
    const wb = new ExcelJS.Workbook()
    // @ts-expect-error - Node 22+ Buffer type differs from ExcelJS expectation
    await wb.xlsx.load(buf)
    expect(wb.worksheets.length).toBe(2)
    expect(wb.worksheets[1]?.name).toBe('Chart')
  })
})
