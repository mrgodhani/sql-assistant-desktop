import type {
  ColumnDesign,
  ColumnInfo,
  DatabaseSchema,
  DatabaseType,
  ForeignKeyInfo,
  IndexDesign,
  IndexInfo,
  SchemaDesign,
  TableDesign,
  TableInfo
} from '../../shared/types'

export function databaseSchemaToDesign(
  dbSchema: DatabaseSchema,
  dialect: DatabaseType
): SchemaDesign {
  return {
    version: 1,
    dialect,
    tables: dbSchema.tables.map(convertTable)
  }
}

function convertTable(table: TableInfo): TableDesign {
  const fkByColumn = buildForeignKeyMap(table.foreignKeys)

  const result: TableDesign = {
    name: table.name,
    columns: table.columns.map((col) => convertColumn(col, fkByColumn)),
    primaryKey: table.primaryKey
  }

  if (table.schema) {
    result.schema = table.schema
  }

  if (table.indexes.length > 0) {
    result.indexes = table.indexes.map(convertIndex)
  }

  return result
}

/**
 * For each FK, maps the first participating column name to its FK design.
 * Multi-column FKs are attached to the first column only (v1 limitation).
 */
function buildForeignKeyMap(
  foreignKeys: ForeignKeyInfo[]
): Map<string, { table: string; column: string }> {
  const map = new Map<string, { table: string; column: string }>()

  for (const fk of foreignKeys) {
    if (fk.columns.length === 0) continue
    const sourceCol = fk.columns[0]
    const refCol = fk.referencedColumns[0] ?? fk.columns[0]

    if (!map.has(sourceCol)) {
      map.set(sourceCol, { table: fk.referencedTable, column: refCol })
    }
  }

  return map
}

function convertColumn(
  col: ColumnInfo,
  fkByColumn: Map<string, { table: string; column: string }>
): ColumnDesign {
  const result: ColumnDesign = {
    name: col.name,
    type: col.type,
    nullable: col.nullable
  }

  if (col.defaultValue !== undefined) {
    result.default = col.defaultValue
  }

  const fk = fkByColumn.get(col.name)
  if (fk) {
    result.foreignKey = fk
  }

  return result
}

function convertIndex(idx: IndexInfo): IndexDesign {
  return {
    name: idx.name,
    columns: idx.columns,
    unique: idx.isUnique
  }
}
