/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { postgresJsonToMermaid } from './explain-parser'

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
