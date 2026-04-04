import type { DesignerSchema, DesignerTable, DesignerRelationship, DesignerDDLResult } from '../../shared/types'

function columnDDL(col: { name: string; type: string; nullable: boolean; isPrimaryKey: boolean }): string {
  const parts = [`  ${col.name} ${col.type}`]
  if (col.isPrimaryKey) parts.push('PRIMARY KEY')
  if (!col.nullable && !col.isPrimaryKey) parts.push('NOT NULL')
  return parts.join(' ')
}

function tableDDL(table: DesignerTable, relationships: DesignerRelationship[], allTables: DesignerTable[]): string {
  const lines: string[] = []

  const columnLines = table.columns.map(columnDDL)

  const fkLines = relationships
    .filter((r) => r.fromTableId === table.id)
    .map((r) => {
      const fromCol = table.columns.find((c) => c.id === r.fromColumnId)
      const toTable = allTables.find((t) => t.id === r.toTableId)
      const toCol = toTable?.columns.find((c) => c.id === r.toColumnId)
      if (!fromCol || !toTable || !toCol) return null
      return `  FOREIGN KEY (${fromCol.name}) REFERENCES ${toTable.name}(${toCol.name})`
    })
    .filter((l): l is string => l !== null)

  const allLines = [...columnLines, ...fkLines]

  lines.push(`CREATE TABLE ${table.name} (`)
  lines.push(allLines.join(',\n'))
  lines.push(');')

  return lines.join('\n')
}

export function generateDDL(schema: DesignerSchema): DesignerDDLResult {
  try {
    if (!schema.tables || schema.tables.length === 0) {
      return { success: true, ddl: '' }
    }

    const statements = schema.tables.map((table) =>
      tableDDL(table, schema.relationships ?? [], schema.tables)
    )

    return { success: true, ddl: statements.join('\n\n') }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate DDL'
    }
  }
}
