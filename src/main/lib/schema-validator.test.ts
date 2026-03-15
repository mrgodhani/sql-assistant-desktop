import type { SchemaDesign } from '../../shared/types'
import { validateSchemaDesign } from './schema-validator'

function makeSchema(overrides: Partial<SchemaDesign> = {}): SchemaDesign {
  return { version: 1, dialect: 'postgresql', tables: [], ...overrides }
}

describe('validateSchemaDesign', () => {
  it('returns valid for an empty schema', () => {
    const result = validateSchemaDesign(makeSchema())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns valid for a schema with tables and foreign keys', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'int', nullable: false },
              { name: 'email', type: 'varchar', nullable: false }
            ],
            primaryKey: ['id']
          },
          {
            name: 'posts',
            columns: [
              { name: 'id', type: 'int', nullable: false },
              {
                name: 'author_id',
                type: 'int',
                nullable: false,
                foreignKey: { table: 'users', column: 'id' }
              }
            ],
            primaryKey: ['id']
          }
        ]
      })
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects duplicate table names', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [
          { name: 'users', columns: [], primaryKey: [] },
          { name: 'users', columns: [], primaryKey: [] }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Duplicate table name: users')
  })

  it('detects FK referencing a non-existent table', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [
          {
            name: 'posts',
            columns: [
              {
                name: 'author_id',
                type: 'int',
                nullable: false,
                foreignKey: { table: 'users', column: 'id' }
              }
            ],
            primaryKey: ['author_id']
          }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('non-existent table "users"')
  })

  it('detects PK referencing a non-existent column', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [
          {
            name: 'users',
            columns: [{ name: 'id', type: 'int', nullable: false }],
            primaryKey: ['missing_col']
          }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Primary key column "missing_col" does not exist')
  })

  it('detects duplicate column names within a table', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'int', nullable: false },
              { name: 'id', type: 'varchar', nullable: true }
            ],
            primaryKey: ['id']
          }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Duplicate column name "id" in table "users"')
  })

  it('warns when a table has no primary key', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [
          {
            name: 'logs',
            columns: [{ name: 'message', type: 'text', nullable: false }],
            primaryKey: []
          }
        ]
      })
    )
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('Table "logs" has no primary key')
  })

  it('warns when a table has no columns', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [{ name: 'empty', columns: [], primaryKey: [] }]
      })
    )
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('Table "empty" has no columns')
  })

  it('detects FK referencing a non-existent column in the target table', () => {
    const result = validateSchemaDesign(
      makeSchema({
        tables: [
          {
            name: 'users',
            columns: [{ name: 'id', type: 'int', nullable: false }],
            primaryKey: ['id']
          },
          {
            name: 'posts',
            columns: [
              {
                name: 'author_id',
                type: 'int',
                nullable: false,
                foreignKey: { table: 'users', column: 'email' }
              }
            ],
            primaryKey: ['author_id']
          }
        ]
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('non-existent column "users.email"')
  })
})
