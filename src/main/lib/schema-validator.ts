import type { SchemaDesign, SchemaValidationResult, TableDesign } from '../../shared/types'

/**
 * Normalizes an AI-generated schema so missing optional arrays
 * default to empty arrays instead of undefined.
 */
export function normalizeSchemaDesign(schema: unknown): SchemaDesign {
  const s = schema as Record<string, unknown>
  const tables = Array.isArray(s.tables) ? s.tables : []

  return {
    version: 1,
    dialect: (s.dialect as SchemaDesign['dialect']) ?? 'postgresql',
    tables: tables.map(
      (t: Record<string, unknown>): TableDesign => ({
        name: String(t.name ?? ''),
        schema: t.schema != null ? String(t.schema) : undefined,
        columns: Array.isArray(t.columns)
          ? t.columns.map((c: Record<string, unknown>) => ({
              name: String(c.name ?? ''),
              type: String(c.type ?? 'text'),
              nullable: c.nullable !== false,
              default: c.default != null ? String(c.default) : undefined,
              unique: c.unique === true ? true : undefined,
              foreignKey: c.foreignKey
                ? {
                    table: String((c.foreignKey as Record<string, unknown>).table ?? ''),
                    column: String((c.foreignKey as Record<string, unknown>).column ?? '')
                  }
                : undefined
            }))
          : [],
        primaryKey: Array.isArray(t.primaryKey) ? t.primaryKey.map(String) : [],
        indexes: Array.isArray(t.indexes)
          ? t.indexes.map((idx: Record<string, unknown>) => ({
              name: String(idx.name ?? ''),
              columns: Array.isArray(idx.columns) ? idx.columns.map(String) : [],
              unique: idx.unique === true
            }))
          : undefined,
        comment: t.comment != null ? String(t.comment) : undefined
      })
    ),
    enums: Array.isArray(s.enums)
      ? s.enums.map((e: Record<string, unknown>) => ({
          name: String(e.name ?? ''),
          values: Array.isArray(e.values) ? e.values.map(String) : []
        }))
      : undefined
  }
}

export function validateSchemaDesign(schema: SchemaDesign): SchemaValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!Array.isArray(schema.tables)) {
    return { valid: false, errors: ['Schema has no tables array'], warnings: [] }
  }

  const tableNames = new Set<string>()
  const tableColumnMap = new Map<string, Set<string>>()

  for (const table of schema.tables) {
    if (tableNames.has(table.name)) {
      errors.push(`Duplicate table name: ${table.name}`)
    }
    tableNames.add(table.name)

    const columns = table.columns ?? []
    const primaryKey = table.primaryKey ?? []

    const columnNames = new Set<string>()
    for (const col of columns) {
      if (columnNames.has(col.name)) {
        errors.push(`Duplicate column name "${col.name}" in table "${table.name}"`)
      }
      columnNames.add(col.name)
    }
    tableColumnMap.set(table.name, columnNames)

    if (columns.length === 0) {
      warnings.push(`Table "${table.name}" has no columns`)
    }

    if (primaryKey.length === 0 && columns.length > 0) {
      warnings.push(`Table "${table.name}" has no primary key`)
    }

    for (const pkCol of primaryKey) {
      if (!columnNames.has(pkCol)) {
        errors.push(`Primary key column "${pkCol}" does not exist in table "${table.name}"`)
      }
    }
  }

  for (const table of schema.tables) {
    for (const col of table.columns ?? []) {
      if (!col.foreignKey) continue
      const { table: refTable, column: refCol } = col.foreignKey

      if (!tableNames.has(refTable)) {
        errors.push(
          `Foreign key in "${table.name}.${col.name}" references non-existent table "${refTable}"`
        )
        continue
      }

      const refColumns = tableColumnMap.get(refTable)
      if (refColumns && !refColumns.has(refCol)) {
        errors.push(
          `Foreign key in "${table.name}.${col.name}" references non-existent column "${refTable}.${refCol}"`
        )
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
