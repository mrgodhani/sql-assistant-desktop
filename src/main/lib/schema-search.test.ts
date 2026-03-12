/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { searchSchema } from './schema-search'

describe('searchSchema', () => {
  const schema = {
    tables: [
      { name: 'orders', columns: [{ name: 'customer_id' }, { name: 'order_date' }] },
      { name: 'customers', columns: [{ name: 'id' }, { name: 'email' }] }
    ],
    views: []
  }

  it('returns matches for partial table name', () => {
    const result = searchSchema(schema, 'customer')
    expect(result.length).toBeGreaterThan(0)
    expect(result.some(r => r.table === 'customers')).toBe(true)
  })

  it('returns matches for partial column name', () => {
    const result = searchSchema(schema, 'customer_id')
    expect(result.some(r => r.column === 'customer_id')).toBe(true)
  })

  it('returns empty array for no matches', () => {
    const result = searchSchema(schema, 'xyzzy')
    expect(result).toEqual([])
  })

  it('returns empty array for empty or whitespace query', () => {
    expect(searchSchema(schema, '')).toEqual([])
    expect(searchSchema(schema, '   ')).toEqual([])
  })
})
