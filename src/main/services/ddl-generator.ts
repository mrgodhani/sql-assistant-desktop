import type {
  SchemaDesign,
  TableDesign,
  ColumnDesign,
  DDLResult,
  DatabaseType
} from '../../shared/types'

function quoteId(name: string, dialect: DatabaseType): string {
  return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
}

function topologicalSort(tables: TableDesign[]): TableDesign[] {
  const nameToTable = new Map(tables.map((t) => [t.name, t]))
  const visited = new Set<string>()
  const sorted: TableDesign[] = []

  function visit(name: string): void {
    if (visited.has(name)) return
    visited.add(name)

    const table = nameToTable.get(name)
    if (!table) return

    for (const col of table.columns) {
      if (col.foreignKey) {
        visit(col.foreignKey.table)
      }
    }

    sorted.push(table)
  }

  for (const table of tables) {
    visit(table.name)
  }

  return sorted
}

function generateColumnDef(col: ColumnDesign, dialect: DatabaseType): string {
  const parts: string[] = [quoteId(col.name, dialect), col.type]

  if (!col.nullable) parts.push('NOT NULL')
  if (col.unique) parts.push('UNIQUE')
  if (col.default !== undefined) parts.push(`DEFAULT ${col.default}`)

  return parts.join(' ')
}

function generateCreateTable(table: TableDesign, dialect: DatabaseType): string {
  const q = (name: string) => quoteId(name, dialect)
  const lines: string[] = []

  for (const col of table.columns) {
    lines.push(`  ${generateColumnDef(col, dialect)}`)
  }

  if (table.primaryKey.length > 0) {
    lines.push(`  PRIMARY KEY (${table.primaryKey.map((c) => q(c)).join(', ')})`)
  }

  for (const col of table.columns) {
    if (!col.foreignKey) continue
    const fk = col.foreignKey
    let constraint = `  FOREIGN KEY (${q(col.name)}) REFERENCES ${q(fk.table)} (${q(fk.column)})`
    if (fk.onDelete) constraint += ` ON DELETE ${fk.onDelete}`
    if (fk.onUpdate) constraint += ` ON UPDATE ${fk.onUpdate}`
    lines.push(constraint)
  }

  const tableName = table.schema ? `${q(table.schema)}.${q(table.name)}` : q(table.name)
  return `CREATE TABLE ${tableName} (\n${lines.join(',\n')}\n);`
}

function generateIndexes(table: TableDesign, dialect: DatabaseType): string[] {
  if (!table.indexes?.length) return []

  const q = (name: string) => quoteId(name, dialect)
  return table.indexes.map((idx) => {
    const unique = idx.unique ? 'UNIQUE ' : ''
    const cols = idx.columns.map((c) => q(c)).join(', ')
    return `CREATE ${unique}INDEX ${q(idx.name)} ON ${q(table.name)} (${cols});`
  })
}

function generateEnums(schema: SchemaDesign): string[] {
  if (schema.dialect !== 'postgresql' || !schema.enums?.length) return []

  return schema.enums.map((e) => {
    const values = e.values.map((v) => `'${v}'`).join(', ')
    return `CREATE TYPE "${e.name}" AS ENUM (${values});`
  })
}

function generateCreate(schema: SchemaDesign): string[] {
  const statements: string[] = []

  statements.push(...generateEnums(schema))

  const sorted = topologicalSort(schema.tables)
  for (const table of sorted) {
    statements.push(generateCreateTable(table, schema.dialect))
    statements.push(...generateIndexes(table, schema.dialect))
  }

  return statements
}

function generateMigrate(target: SchemaDesign, base: SchemaDesign): string[] {
  const q = (name: string) => quoteId(name, target.dialect)
  const statements: string[] = []

  const baseTableMap = new Map(base.tables.map((t) => [t.name, t]))
  const targetTableMap = new Map(target.tables.map((t) => [t.name, t]))

  for (const table of target.tables) {
    const baseTable = baseTableMap.get(table.name)
    if (!baseTable) {
      statements.push(generateCreateTable(table, target.dialect))
      statements.push(...generateIndexes(table, target.dialect))
      continue
    }

    const baseColNames = new Set(baseTable.columns.map((c) => c.name))
    const targetColNames = new Set(table.columns.map((c) => c.name))

    for (const col of table.columns) {
      if (!baseColNames.has(col.name)) {
        statements.push(
          `ALTER TABLE ${q(table.name)} ADD COLUMN ${generateColumnDef(col, target.dialect)};`
        )
      }
    }

    for (const col of baseTable.columns) {
      if (!targetColNames.has(col.name)) {
        statements.push(`ALTER TABLE ${q(table.name)} DROP COLUMN ${q(col.name)};`)
      }
    }
  }

  for (const baseTable of base.tables) {
    if (!targetTableMap.has(baseTable.name)) {
      statements.push(`DROP TABLE ${q(baseTable.name)};`)
    }
  }

  return statements
}

export function generateDDL(
  schema: SchemaDesign,
  mode: 'create' | 'migrate',
  baseSchema?: SchemaDesign
): DDLResult {
  const statements =
    mode === 'create'
      ? generateCreate(schema)
      : generateMigrate(schema, baseSchema ?? { version: 1, dialect: schema.dialect, tables: [] })

  return { statements, dialect: schema.dialect }
}
