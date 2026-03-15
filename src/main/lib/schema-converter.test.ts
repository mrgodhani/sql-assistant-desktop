import type { DatabaseSchema, TableInfo } from '../../shared/types'
import { databaseSchemaToDesign } from './schema-converter'

function makeTable(overrides: Partial<TableInfo> = {}): TableInfo {
  return {
    name: 'test_table',
    type: 'table',
    columns: [],
    primaryKey: [],
    foreignKeys: [],
    indexes: [],
    ...overrides
  }
}

function makeDbSchema(tables: TableInfo[] = [], views: TableInfo[] = []): DatabaseSchema {
  return {
    connectionId: 'conn-1',
    tables,
    views,
    introspectedAt: '2025-01-01T00:00:00Z'
  }
}

describe('databaseSchemaToDesign', () => {
  it('converts a simple table with columns, PK, and indexes', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema([
        makeTable({
          name: 'users',
          columns: [
            { name: 'id', type: 'int', nullable: false, isPrimaryKey: true, isAutoIncrement: true },
            { name: 'email', type: 'varchar(255)', nullable: false, isPrimaryKey: false, isAutoIncrement: false }
          ],
          primaryKey: ['id'],
          indexes: [{ name: 'idx_email', columns: ['email'], isUnique: true }]
        })
      ]),
      'postgresql'
    )

    expect(result.version).toBe(1)
    expect(result.dialect).toBe('postgresql')
    expect(result.tables).toHaveLength(1)

    const table = result.tables[0]
    expect(table.name).toBe('users')
    expect(table.primaryKey).toEqual(['id'])
    expect(table.columns).toHaveLength(2)
    expect(table.columns[0]).toEqual({ name: 'id', type: 'int', nullable: false })
    expect(table.columns[1]).toEqual({ name: 'email', type: 'varchar(255)', nullable: false })

    expect(table.indexes).toHaveLength(1)
    expect(table.indexes![0]).toEqual({ name: 'idx_email', columns: ['email'], unique: true })
  })

  it('maps single-column foreign key onto the column', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema([
        makeTable({
          name: 'posts',
          columns: [
            { name: 'id', type: 'int', nullable: false, isPrimaryKey: true, isAutoIncrement: true },
            { name: 'author_id', type: 'int', nullable: false, isPrimaryKey: false, isAutoIncrement: false }
          ],
          primaryKey: ['id'],
          foreignKeys: [
            {
              name: 'fk_posts_author',
              columns: ['author_id'],
              referencedTable: 'users',
              referencedColumns: ['id']
            }
          ]
        })
      ]),
      'mysql'
    )

    const authorCol = result.tables[0].columns.find((c) => c.name === 'author_id')!
    expect(authorCol.foreignKey).toEqual({ table: 'users', column: 'id' })
  })

  it('attaches multi-column FK to the first column', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema([
        makeTable({
          name: 'order_items',
          columns: [
            { name: 'order_id', type: 'int', nullable: false, isPrimaryKey: false, isAutoIncrement: false },
            { name: 'product_id', type: 'int', nullable: false, isPrimaryKey: false, isAutoIncrement: false }
          ],
          primaryKey: ['order_id', 'product_id'],
          foreignKeys: [
            {
              columns: ['order_id', 'product_id'],
              referencedTable: 'orders',
              referencedColumns: ['id', 'product_id']
            }
          ]
        })
      ]),
      'postgresql'
    )

    const orderCol = result.tables[0].columns.find((c) => c.name === 'order_id')!
    expect(orderCol.foreignKey).toEqual({ table: 'orders', column: 'id' })

    const productCol = result.tables[0].columns.find((c) => c.name === 'product_id')!
    expect(productCol.foreignKey).toBeUndefined()
  })

  it('skips views — only tables are converted', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema(
        [makeTable({ name: 'users' })],
        [makeTable({ name: 'active_users', type: 'view' })]
      ),
      'sqlite'
    )

    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('users')
  })

  it('maps defaultValue to default', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema([
        makeTable({
          name: 'settings',
          columns: [
            { name: 'key', type: 'varchar(100)', nullable: false, isPrimaryKey: true, isAutoIncrement: false },
            { name: 'value', type: 'text', nullable: true, defaultValue: "''", isPrimaryKey: false, isAutoIncrement: false }
          ],
          primaryKey: ['key']
        })
      ]),
      'postgresql'
    )

    const valCol = result.tables[0].columns.find((c) => c.name === 'value')!
    expect(valCol.default).toBe("''")
    expect((valCol as Record<string, unknown>)['defaultValue']).toBeUndefined()
  })

  it('returns empty tables for an empty schema', () => {
    const result = databaseSchemaToDesign(makeDbSchema(), 'sqlserver')

    expect(result.version).toBe(1)
    expect(result.dialect).toBe('sqlserver')
    expect(result.tables).toEqual([])
  })

  it('preserves table schema when present', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema([makeTable({ name: 'users', schema: 'public' })]),
      'postgresql'
    )

    expect(result.tables[0].schema).toBe('public')
  })

  it('omits schema when not present', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema([makeTable({ name: 'users' })]),
      'mysql'
    )

    expect(result.tables[0].schema).toBeUndefined()
  })

  it('omits indexes when table has none', () => {
    const result = databaseSchemaToDesign(
      makeDbSchema([makeTable({ name: 'simple', indexes: [] })]),
      'sqlite'
    )

    expect(result.tables[0].indexes).toBeUndefined()
  })
})
