import { describe, it, expect } from 'vitest'
import { generateDDL } from '../designer-ddl'
import type { DesignerSchema } from '../../../shared/types'

function makeTable(
  name: string,
  columns: Array<{ name: string; type: string; nullable: boolean; isPrimaryKey: boolean }>
) {
  return {
    id: `table-${name}`,
    name,
    columns: columns.map((c, i) => ({ id: `col-${name}-${i}`, ...c }))
  }
}

describe('generateDDL', () => {
  it('returns empty string for schema with no tables', () => {
    const schema: DesignerSchema = { tables: [], relationships: [] }
    const result = generateDDL(schema)
    expect(result.success).toBe(true)
    expect(result.ddl).toBe('')
  })

  it('generates CREATE TABLE for a single table with a primary key', () => {
    const schema: DesignerSchema = {
      tables: [makeTable('users', [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }])],
      relationships: []
    }
    const result = generateDDL(schema)
    expect(result.success).toBe(true)
    expect(result.ddl).toContain('CREATE TABLE users')
    expect(result.ddl).toContain('id INTEGER PRIMARY KEY')
  })

  it('marks non-nullable non-PK columns as NOT NULL', () => {
    const schema: DesignerSchema = {
      tables: [
        makeTable('users', [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
          { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false },
          { name: 'bio', type: 'TEXT', nullable: true, isPrimaryKey: false }
        ])
      ],
      relationships: []
    }
    const result = generateDDL(schema)
    expect(result.success).toBe(true)
    expect(result.ddl).toContain('email VARCHAR(255) NOT NULL')
    expect(result.ddl).not.toContain('bio TEXT NOT NULL')
  })

  it('adds FOREIGN KEY constraints for relationships', () => {
    const usersTable = makeTable('users', [
      { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }
    ])
    const postsTable = makeTable('posts', [
      { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
      { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false }
    ])
    const schema: DesignerSchema = {
      tables: [usersTable, postsTable],
      relationships: [
        {
          id: 'rel-1',
          fromTableId: postsTable.id,
          fromColumnId: postsTable.columns[1].id,
          toTableId: usersTable.id,
          toColumnId: usersTable.columns[0].id,
          type: '1:N'
        }
      ]
    }
    const result = generateDDL(schema)
    expect(result.success).toBe(true)
    expect(result.ddl).toContain('FOREIGN KEY (user_id) REFERENCES users(id)')
  })
})
