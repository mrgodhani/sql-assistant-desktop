import type { SchemaDesign, SchemaValidationResult } from '../../shared/types'

export function validateSchemaDesign(schema: SchemaDesign): SchemaValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const tableNames = new Set<string>()
  const tableColumnMap = new Map<string, Set<string>>()

  for (const table of schema.tables) {
    if (tableNames.has(table.name)) {
      errors.push(`Duplicate table name: ${table.name}`)
    }
    tableNames.add(table.name)

    const columnNames = new Set<string>()
    for (const col of table.columns) {
      if (columnNames.has(col.name)) {
        errors.push(`Duplicate column name "${col.name}" in table "${table.name}"`)
      }
      columnNames.add(col.name)
    }
    tableColumnMap.set(table.name, columnNames)

    if (table.columns.length === 0) {
      warnings.push(`Table "${table.name}" has no columns`)
    }

    if (table.primaryKey.length === 0 && table.columns.length > 0) {
      warnings.push(`Table "${table.name}" has no primary key`)
    }

    for (const pkCol of table.primaryKey) {
      if (!columnNames.has(pkCol)) {
        errors.push(`Primary key column "${pkCol}" does not exist in table "${table.name}"`)
      }
    }
  }

  for (const table of schema.tables) {
    for (const col of table.columns) {
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
