/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { generateDDL } from './ddl-generator'
import type { SchemaDesign } from '../../shared/types'

describe('generateDDL', () => {
  describe('create mode – PostgreSQL', () => {
    it('generates CREATE TABLE with columns and PK', () => {
      const schema: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true }
            ],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(schema, 'create')

      expect(result.dialect).toBe('postgresql')
      expect(result.statements).toHaveLength(1)
      expect(result.statements[0]).toContain('CREATE TABLE "users"')
      expect(result.statements[0]).toContain('"id" SERIAL NOT NULL')
      expect(result.statements[0]).toContain('"email" VARCHAR(255) NOT NULL UNIQUE')
      expect(result.statements[0]).toContain('PRIMARY KEY ("id")')
    })

    it('generates FK constraints with ON DELETE', () => {
      const schema: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'departments',
            columns: [{ name: 'id', type: 'SERIAL', nullable: false }],
            primaryKey: ['id']
          },
          {
            name: 'employees',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              {
                name: 'dept_id',
                type: 'INTEGER',
                nullable: false,
                foreignKey: { table: 'departments', column: 'id', onDelete: 'CASCADE' }
              }
            ],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(schema, 'create')
      const empStmt = result.statements.find((s) => s.includes('"employees"'))!
      expect(empStmt).toContain('FOREIGN KEY ("dept_id") REFERENCES "departments" ("id")')
      expect(empStmt).toContain('ON DELETE CASCADE')
    })

    it('generates CREATE INDEX and CREATE UNIQUE INDEX', () => {
      const schema: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'products',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              { name: 'sku', type: 'VARCHAR(50)', nullable: false },
              { name: 'category', type: 'VARCHAR(100)', nullable: true }
            ],
            primaryKey: ['id'],
            indexes: [
              { name: 'idx_products_sku', columns: ['sku'], unique: true },
              { name: 'idx_products_category', columns: ['category'], unique: false }
            ]
          }
        ]
      }

      const result = generateDDL(schema, 'create')
      expect(result.statements).toContain(
        'CREATE UNIQUE INDEX "idx_products_sku" ON "products" ("sku");'
      )
      expect(result.statements).toContain(
        'CREATE INDEX "idx_products_category" ON "products" ("category");'
      )
    })

    it('preserves DEFAULT values', () => {
      const schema: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'settings',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              { name: 'active', type: 'BOOLEAN', nullable: false, default: 'true' },
              { name: 'priority', type: 'INTEGER', nullable: false, default: '0' }
            ],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(schema, 'create')
      expect(result.statements[0]).toContain('"active" BOOLEAN NOT NULL DEFAULT true')
      expect(result.statements[0]).toContain('"priority" INTEGER NOT NULL DEFAULT 0')
    })

    it('topologically sorts tables so referenced tables come first', () => {
      const schema: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'orders',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              {
                name: 'customer_id',
                type: 'INTEGER',
                nullable: false,
                foreignKey: { table: 'customers', column: 'id' }
              }
            ],
            primaryKey: ['id']
          },
          {
            name: 'customers',
            columns: [{ name: 'id', type: 'SERIAL', nullable: false }],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(schema, 'create')
      const customersIdx = result.statements.findIndex((s) => s.includes('"customers"'))
      const ordersIdx = result.statements.findIndex((s) => s.includes('"orders"'))
      expect(customersIdx).toBeLessThan(ordersIdx)
    })

    it('generates CREATE TYPE for enums', () => {
      const schema: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'tasks',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              { name: 'status', type: 'task_status', nullable: false }
            ],
            primaryKey: ['id']
          }
        ],
        enums: [{ name: 'task_status', values: ['pending', 'active', 'done'] }]
      }

      const result = generateDDL(schema, 'create')
      expect(result.statements[0]).toBe(
        "CREATE TYPE \"task_status\" AS ENUM ('pending', 'active', 'done');"
      )
    })
  })

  describe('migrate mode', () => {
    it('generates ALTER TABLE ADD COLUMN for new columns', () => {
      const base: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'users',
            columns: [{ name: 'id', type: 'SERIAL', nullable: false }],
            primaryKey: ['id']
          }
        ]
      }
      const target: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              { name: 'name', type: 'VARCHAR(100)', nullable: true }
            ],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(target, 'migrate', base)
      expect(result.statements).toContain(
        'ALTER TABLE "users" ADD COLUMN "name" VARCHAR(100);'
      )
    })

    it('generates DROP TABLE for removed tables', () => {
      const base: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'users',
            columns: [{ name: 'id', type: 'SERIAL', nullable: false }],
            primaryKey: ['id']
          },
          {
            name: 'legacy',
            columns: [{ name: 'id', type: 'SERIAL', nullable: false }],
            primaryKey: ['id']
          }
        ]
      }
      const target: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'users',
            columns: [{ name: 'id', type: 'SERIAL', nullable: false }],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(target, 'migrate', base)
      expect(result.statements).toContain('DROP TABLE "legacy";')
    })

    it('generates ALTER TABLE DROP COLUMN for removed columns', () => {
      const base: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'SERIAL', nullable: false },
              { name: 'old_field', type: 'TEXT', nullable: true }
            ],
            primaryKey: ['id']
          }
        ]
      }
      const target: SchemaDesign = {
        version: 1,
        dialect: 'postgresql',
        tables: [
          {
            name: 'users',
            columns: [{ name: 'id', type: 'SERIAL', nullable: false }],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(target, 'migrate', base)
      expect(result.statements).toContain('ALTER TABLE "users" DROP COLUMN "old_field";')
    })
  })

  describe('MySQL dialect', () => {
    it('uses backtick quoting', () => {
      const schema: SchemaDesign = {
        version: 1,
        dialect: 'mysql',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'INT AUTO_INCREMENT', nullable: false },
              { name: 'email', type: 'VARCHAR(255)', nullable: false }
            ],
            primaryKey: ['id']
          }
        ]
      }

      const result = generateDDL(schema, 'create')
      expect(result.dialect).toBe('mysql')
      expect(result.statements[0]).toContain('CREATE TABLE `users`')
      expect(result.statements[0]).toContain('`id`')
      expect(result.statements[0]).toContain('PRIMARY KEY (`id`)')
    })
  })
})
