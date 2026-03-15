export interface SearchResult {
  table: string
  column: string
}

/** Minimal schema shape needed for search. DatabaseSchema satisfies this. */
interface SearchableSchema {
  tables: Array<{ name: string; schema?: string; columns: Array<{ name: string }> }>
  views: Array<{ name: string; schema?: string; columns: Array<{ name: string }> }>
}

function qualifiedTableName(table: { name: string; schema?: string }): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name
}

/**
 * Fuzzy search over schema tables and views.
 * Matches when query is included (case-insensitive) in table or column names.
 */
export function searchSchema(schema: SearchableSchema, query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results: SearchResult[] = []

  const searchIn = (items: SearchableSchema['tables']): void => {
    for (const table of items) {
      const tableName = qualifiedTableName(table)
      const tableMatches = tableName.toLowerCase().includes(q)
      for (const col of table.columns) {
        const colMatches = col.name.toLowerCase().includes(q)
        if (tableMatches || colMatches) {
          results.push({ table: tableName, column: col.name })
        }
      }
    }
  }

  searchIn(schema.tables)
  searchIn(schema.views)

  return results
}
