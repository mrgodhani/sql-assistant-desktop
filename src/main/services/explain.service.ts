import log from 'electron-log/main'
import { databaseService } from './database.service'
import {
  postgresJsonToMermaid,
  mysqlJsonToMermaid,
  sqliteTextToMermaid,
  type PostgresExplainEntry
} from '../lib/explain-parser'

export interface ExplainResult {
  raw: string
  mermaid: string
}

function getFirstColumnValue(row: Record<string, unknown>): string {
  const keys = Object.keys(row)
  if (keys.length === 0) return ''
  const firstKey = keys[0]
  const val = row[firstKey]
  if (typeof val === 'string') return val
  if (val != null && typeof val === 'object') return JSON.stringify(val)
  return String(val ?? '')
}

export async function runExplain(connectionId: string, sql: string): Promise<ExplainResult> {
  const dbType = databaseService.getConnectionType(connectionId)
  if (!dbType) {
    throw new Error('Connection is not active')
  }

  const trimmed = sql.trim()
  if (!trimmed) {
    throw new Error('SQL query is required')
  }

  let wrapped: string
  switch (dbType) {
    case 'postgresql':
      wrapped = `EXPLAIN (FORMAT JSON) ${trimmed}`
      break
    case 'mysql':
      wrapped = `EXPLAIN FORMAT=JSON ${trimmed}`
      break
    case 'sqlite':
      wrapped = `EXPLAIN QUERY PLAN ${trimmed}`
      break
    case 'sqlserver':
      throw new Error('EXPLAIN is not yet supported for SQL Server')
    default:
      throw new Error(`Unsupported database type: ${dbType}`)
  }

  const result = await databaseService.executeQuery(connectionId, wrapped)
  const raw = formatRawResult(result)

  let mermaid: string
  try {
    switch (dbType) {
      case 'postgresql': {
        const firstRow = result.rows[0]
        const jsonStr = firstRow ? getFirstColumnValue(firstRow) : ''
        const parsed = JSON.parse(jsonStr || '[]') as PostgresExplainEntry[]
        mermaid = postgresJsonToMermaid(parsed)
        break
      }
      case 'mysql': {
        const firstRow = result.rows[0]
        const jsonStr = firstRow ? getFirstColumnValue(firstRow) : ''
        const parsed = JSON.parse(jsonStr || '{}') as unknown
        mermaid = mysqlJsonToMermaid(parsed)
        break
      }
      case 'sqlite': {
        const lines = result.rows.map((r) => getFirstColumnValue(r))
        mermaid = sqliteTextToMermaid(lines.join('\n'))
        break
      }
      default:
        mermaid = 'flowchart TB'
    }
  } catch (error) {
    log.warn('[Explain] Mermaid parse failed, using raw only:', error)
    mermaid = 'flowchart TB'
  }

  return { raw, mermaid }
}

function formatRawResult(result: { columns: string[]; rows: Record<string, unknown>[] }): string {
  if (result.rows.length === 0) return ''
  const lines: string[] = []
  for (const row of result.rows) {
    const val = getFirstColumnValue(row)
    if (val) lines.push(val)
  }
  return lines.join('\n')
}
