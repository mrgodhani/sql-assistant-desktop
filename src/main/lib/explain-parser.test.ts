/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { postgresJsonToMermaid, mysqlJsonToMermaid, sqliteTextToMermaid } from './explain-parser'

describe('postgresJsonToMermaid', () => {
  it('converts a simple PostgreSQL EXPLAIN JSON plan to Mermaid flowchart', () => {
    const postgresJson = [
      {
        Plan: {
          'Node Type': 'Limit',
          'Plan Rows': 100,
          Plans: [
            {
              'Node Type': 'Seq Scan',
              'Relation Name': 'users',
              'Plan Rows': 1000
            }
          ]
        }
      }
    ]

    const result = postgresJsonToMermaid(postgresJson)

    expect(result).toContain('flowchart TB')
    expect(result).toContain('Limit')
    expect(result).toContain('Seq Scan')
    expect(result).toContain('users')
    expect(result).toContain('100')
    expect(result).toContain('1000')
    // Node IDs should be sanitized (alphanumeric + underscore only)
    expect(result).toMatch(/Limit_\d+\[/)
    expect(result).toMatch(/Seq_Scan_\d+\[/)
    // Should have parent --> child edge
    expect(result).toContain('-->')
  })
})

describe('mysqlJsonToMermaid', () => {
  it('converts MySQL EXPLAIN FORMAT=JSON with nested_loop to Mermaid flowchart', () => {
    const mysqlJson = {
      query_block: {
        select_id: 1,
        nested_loop: [
          {
            table: {
              table_name: 'employees',
              access_type: 'ALL',
              rows_examined_per_scan: 299379
            }
          },
          {
            table: {
              table_name: 'titles',
              access_type: 'ALL',
              rows_examined_per_scan: 442724,
              key: 'emp_no'
            }
          }
        ]
      }
    }

    const result = mysqlJsonToMermaid(mysqlJson)

    expect(result).toContain('flowchart TB')
    expect(result).toContain('employees')
    expect(result).toContain('titles')
    expect(result).toContain('ALL')
    expect(result).toContain('299379')
    expect(result).toContain('442724')
    expect(result).toContain('emp_no')
    expect(result).toContain('-->')
  })

  it('handles MySQL EXPLAIN wrapped in EXPLAIN key', () => {
    const mysqlJson = {
      EXPLAIN: {
        query_block: {
          nested_loop: [
            {
              table: {
                table_name: 'users',
                access_type: 'ref',
                rows_examined_per_scan: 1
              }
            }
          ]
        }
      }
    }

    const result = mysqlJsonToMermaid(mysqlJson)

    expect(result).toContain('flowchart TB')
    expect(result).toContain('users')
    expect(result).toContain('ref')
  })

  it('returns empty flowchart for invalid MySQL JSON', () => {
    const result = mysqlJsonToMermaid(null)
    expect(result).toBe('flowchart TB')

    const result2 = mysqlJsonToMermaid({ foo: 'bar' })
    expect(result2).toBe('flowchart TB')
  })
})

describe('sqliteTextToMermaid', () => {
  it('converts SQLite EXPLAIN QUERY PLAN with tree format to Mermaid flowchart', () => {
    const sqliteText = `QUERY PLAN
|--SEARCH t1 USING INDEX i2 (a=? AND b?)
\`--SCAN t2`

    const result = sqliteTextToMermaid(sqliteText)

    expect(result).toContain('flowchart TB')
    expect(result).toContain('SEARCH t1 USING INDEX i2 (a=? AND b?)')
    expect(result).toContain('SCAN t2')
    expect(result).toContain('-->')
  })

  it('converts simple SQLite SCAN format', () => {
    const sqliteText = `QUERY PLAN
\`--SCAN users`

    const result = sqliteTextToMermaid(sqliteText)

    expect(result).toContain('flowchart TB')
    expect(result).toContain('SCAN users')
  })

  it('parses nested SQLite plan with indentation', () => {
    const sqliteText = `QUERY PLAN
\`--MULTI-INDEX OR
   |--SEARCH t1 USING COVERING INDEX i2 (a=?)
   \`--SEARCH t1 USING INDEX i3 (b=?)`

    const result = sqliteTextToMermaid(sqliteText)

    expect(result).toContain('flowchart TB')
    expect(result).toContain('MULTI-INDEX OR')
    expect(result).toContain('SEARCH t1 USING COVERING INDEX i2 (a=?)')
    expect(result).toContain('SEARCH t1 USING INDEX i3 (b=?)')
    expect(result).toContain('-->')
  })

  it('handles plain SCAN table_name format without QUERY PLAN header', () => {
    const sqliteText = 'SCAN table_name'
    const result = sqliteTextToMermaid(sqliteText)
    expect(result).toContain('flowchart TB')
    expect(result).toContain('SCAN table_name')
  })

  it('returns empty flowchart for empty or whitespace-only input', () => {
    expect(sqliteTextToMermaid('')).toBe('flowchart TB')
    expect(sqliteTextToMermaid('   \n  \n')).toBe('flowchart TB')
    expect(sqliteTextToMermaid('QUERY PLAN')).toBe('flowchart TB')
  })
})
