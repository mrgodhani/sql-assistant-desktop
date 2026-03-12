import type { DatabaseType } from '../../../shared/types'

const DIALECT_HINTS: Record<DatabaseType, string> = {
  postgresql: 'Use PostgreSQL syntax (e.g., SERIAL, ::type casts, ILIKE, string_agg, CTEs).',
  mysql: 'Use MySQL syntax (e.g., AUTO_INCREMENT, LIMIT, backtick identifiers, GROUP_CONCAT).',
  sqlite:
    'Use SQLite syntax (e.g., AUTOINCREMENT, no ALTER COLUMN, limited data types, no RIGHT JOIN).',
  sqlserver:
    'Use T-SQL syntax (e.g., IDENTITY, TOP, square bracket identifiers, STRING_AGG, OFFSET FETCH).'
}

const BASE_PROMPT = `You are an expert SQL assistant. You help users write, explain, and optimize SQL queries.

Rules:
- Always wrap SQL queries in markdown code blocks with the sql language tag
- When generating SQL, use the correct dialect for the connected database
- If you need more information to write an accurate query, ask clarifying questions
- Explain your reasoning when writing complex queries
- When suggesting optimizations, explain the performance implications
- Format your responses using markdown for readability`

export function buildSystemPrompt(
  schemaContext?: string,
  databaseType?: DatabaseType,
  connectionName?: string
): string {
  const parts: string[] = [BASE_PROMPT]

  if (databaseType && connectionName) {
    parts.push('')
    parts.push(`Connected database: ${connectionName} (${databaseType})`)
    parts.push(`SQL Dialect: ${DIALECT_HINTS[databaseType]}`)

    if (schemaContext) {
      parts.push('')
      parts.push('Database schema:')
      parts.push(schemaContext)
    }
  } else {
    parts.push('')
    parts.push(
      'No database is currently connected. You can still help with general SQL questions, but cannot reference specific tables or columns.'
    )
  }

  return parts.join('\n')
}

const OPTIMIZATION_PROMPT = `You are an expert SQL performance consultant. Analyze the given SQL query and suggest optimizations.

Your response MUST include:
1. **Index recommendations** - Suggest indexes for columns used in WHERE, JOIN, ORDER BY, GROUP BY. Explain why each helps.
2. **Query rewrites** - Suggest alternative formulations (e.g., avoid SELECT *, use EXISTS instead of IN when appropriate, avoid correlated subqueries).
3. **Trade-offs** - Explain the cost of each suggestion (e.g., index maintenance overhead, when a rewrite may not help).

Format your response in markdown. Wrap any suggested SQL in code blocks with the sql language tag.
Be concise but thorough. Focus on the highest-impact improvements first.`

export function buildOptimizationPrompt(
  sql: string,
  schemaContext?: string,
  databaseType?: DatabaseType,
  connectionName?: string
): string {
  const parts: string[] = [OPTIMIZATION_PROMPT]

  if (databaseType && connectionName) {
    parts.push('')
    parts.push(`Database: ${connectionName} (${databaseType})`)
    parts.push(`SQL Dialect: ${DIALECT_HINTS[databaseType]}`)
  }

  if (schemaContext) {
    parts.push('')
    parts.push('Schema:')
    parts.push(schemaContext)
  }

  parts.push('')
  parts.push('Query to optimize:')
  parts.push('```sql')
  parts.push(sql)
  parts.push('```')

  return parts.join('\n')
}
