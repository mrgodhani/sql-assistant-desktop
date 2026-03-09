import log from 'electron-log/main'
import { databaseService } from './database.service'
import type {
  DatabaseType,
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  SchemaIntrospectionResult
} from '../../shared/types'

const QUERY_TIMEOUT_MS = 30_000
const OVERALL_TIMEOUT_MS = 60_000

const VALID_TABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_ $.[\]-]*$/

function sanitizeSchemaError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (/permission|denied|privilege/i.test(msg)) return 'Insufficient permissions to read database schema'
  if (/timed? ?out/i.test(msg)) return 'Schema introspection timed out'
  if (/connection.*closed|not connected/i.test(msg)) return 'Connection was lost during schema introspection'
  if (/SQLITE_CANTOPEN/i.test(msg)) return 'Cannot open database file for schema reading'
  return 'Schema introspection failed'
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!))
}

function assertSafeTableName(name: string): void {
  if (!VALID_TABLE_NAME.test(name)) {
    throw new Error(`Invalid table name for PRAGMA: ${name}`)
  }
}

class SchemaService {
  private cache: Map<string, DatabaseSchema> = new Map()

  async introspect(connectionId: string): Promise<SchemaIntrospectionResult> {
    const now = new Date().toISOString()

    if (!databaseService.isConnected(connectionId)) {
      return { success: false, error: 'Connection is not active', tableCount: 0, introspectedAt: now }
    }

    const dbType = databaseService.getConnectionType(connectionId)
    if (!dbType) {
      return { success: false, error: 'Connection type unknown', tableCount: 0, introspectedAt: now }
    }

    try {
      const schema = await withTimeout(
        this.introspectByType(connectionId, dbType),
        OVERALL_TIMEOUT_MS,
        'Schema introspection'
      )
      schema.connectionId = connectionId
      schema.introspectedAt = now

      this.cache.set(connectionId, schema)

      return {
        success: true,
        schema,
        tableCount: schema.tables.length + schema.views.length,
        introspectedAt: now
      }
    } catch (error) {
      log.error('[Schema] Introspection failed:', sanitizeSchemaError(error))
      return {
        success: false,
        error: sanitizeSchemaError(error),
        tableCount: 0,
        introspectedAt: now
      }
    }
  }

  async refresh(connectionId: string): Promise<SchemaIntrospectionResult> {
    this.cache.delete(connectionId)
    return this.introspect(connectionId)
  }

  getSchemaContext(connectionId: string): string {
    const schema = this.cache.get(connectionId)
    if (!schema) return ''
    return this.formatAsDDL(schema)
  }

  getCachedSchema(connectionId: string): DatabaseSchema | null {
    return this.cache.get(connectionId) ?? null
  }

  clearCache(connectionId: string): void {
    this.cache.delete(connectionId)
  }

  clearAllCaches(): void {
    this.cache.clear()
  }

  private async introspectByType(connectionId: string, dbType: DatabaseType): Promise<DatabaseSchema> {
    switch (dbType) {
      case 'postgresql':
        return this.introspectPostgresql(connectionId)
      case 'mysql':
        return this.introspectMysql(connectionId)
      case 'sqlite':
        return this.introspectSqlite(connectionId)
      case 'sqlserver':
        return this.introspectSqlServer(connectionId)
    }
  }

  // ─── PostgreSQL ─────────────────────────────────────────────────────────────

  private async introspectPostgresql(connectionId: string): Promise<DatabaseSchema> {
    const q = (sql: string) =>
      withTimeout(databaseService.executeQuery(connectionId, sql), QUERY_TIMEOUT_MS, 'PG query')

    const tablesResult = await q(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `)

    const columnsResult = await q(`
      SELECT table_schema, table_name, column_name, udt_name,
             character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name, ordinal_position
    `)

    const pkResult = await q(`
      SELECT tc.table_schema, tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
    `)

    const fkResult = await q(`
      SELECT
        tc.table_schema, tc.table_name, kcu.column_name,
        ccu.table_schema AS referenced_schema,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
    `)

    const rowCountResult = await q(`
      SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables
    `)

    const pkMap = this.groupBy(pkResult.rows, (r) => `${r.table_schema}.${r.table_name}`)
    const colMap = this.groupBy(columnsResult.rows, (r) => `${r.table_schema}.${r.table_name}`)
    const fkMap = this.groupByFk(fkResult.rows, (r) => `${r.table_schema}.${r.table_name}`)
    const rowMap = new Map(rowCountResult.rows.map((r) => [`${r.schemaname}.${r.relname}`, Number(r.n_live_tup)]))

    const tables: TableInfo[] = []
    const views: TableInfo[] = []

    for (const row of tablesResult.rows) {
      const key = `${row.table_schema}.${row.table_name}`
      const isView = row.table_type === 'VIEW'
      const pks = (pkMap.get(key) ?? []).map((r) => String(r.column_name))

      const columns: ColumnInfo[] = (colMap.get(key) ?? []).map((c) => {
        const typeName = this.pgTypeName(String(c.udt_name), c.character_maximum_length as number | null)
        return {
          name: String(c.column_name),
          type: typeName,
          nullable: c.is_nullable === 'YES',
          defaultValue: c.column_default ? String(c.column_default) : undefined,
          isPrimaryKey: pks.includes(String(c.column_name)),
          isAutoIncrement: String(c.column_default ?? '').startsWith('nextval(')
        }
      })

      const foreignKeys = fkMap.get(key) ?? []

      const info: TableInfo = {
        name: String(row.table_name),
        schema: String(row.table_schema),
        type: isView ? 'view' : 'table',
        columns,
        primaryKey: pks,
        foreignKeys,
        indexes: [],
        rowCountEstimate: rowMap.get(key)
      }

      if (isView) views.push(info)
      else tables.push(info)
    }

    return { connectionId: '', tables, views, introspectedAt: '' }
  }

  private pgTypeName(udtName: string, charMaxLen: number | null): string {
    if (charMaxLen && /varchar|char|bpchar/.test(udtName)) return `varchar(${charMaxLen})`
    const typeMap: Record<string, string> = {
      int4: 'integer', int8: 'bigint', int2: 'smallint', float4: 'real', float8: 'double precision',
      bool: 'boolean', varchar: 'varchar', bpchar: 'char', text: 'text', numeric: 'numeric',
      timestamp: 'timestamp', timestamptz: 'timestamptz', date: 'date', time: 'time',
      uuid: 'uuid', json: 'json', jsonb: 'jsonb', bytea: 'bytea', serial: 'serial'
    }
    return typeMap[udtName] ?? udtName
  }

  // ─── MySQL ──────────────────────────────────────────────────────────────────

  private async introspectMysql(connectionId: string): Promise<DatabaseSchema> {
    const q = (sql: string) =>
      withTimeout(databaseService.executeQuery(connectionId, sql), QUERY_TIMEOUT_MS, 'MySQL query')

    const tablesResult = await q(`
      SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `)

    const columnsResult = await q(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
             COLUMN_DEFAULT, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `)

    const fkResult = await q(`
      SELECT TABLE_NAME, COLUMN_NAME,
             REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME,
             CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `)

    const colMap = this.groupBy(columnsResult.rows, (r) => String(r.TABLE_NAME))
    const fkMap = this.groupByFk(
      fkResult.rows,
      (r) => String(r.TABLE_NAME),
      { colKey: 'COLUMN_NAME', refTable: 'REFERENCED_TABLE_NAME', refCol: 'REFERENCED_COLUMN_NAME', name: 'CONSTRAINT_NAME' }
    )

    const tables: TableInfo[] = []
    const views: TableInfo[] = []

    for (const row of tablesResult.rows) {
      const tableName = String(row.TABLE_NAME)
      const isView = String(row.TABLE_TYPE) === 'VIEW'
      const cols = colMap.get(tableName) ?? []

      const pks = cols.filter((c) => c.COLUMN_KEY === 'PRI').map((c) => String(c.COLUMN_NAME))

      const columns: ColumnInfo[] = cols.map((c) => ({
        name: String(c.COLUMN_NAME),
        type: String(c.COLUMN_TYPE),
        nullable: c.IS_NULLABLE === 'YES',
        defaultValue: c.COLUMN_DEFAULT != null ? String(c.COLUMN_DEFAULT) : undefined,
        isPrimaryKey: c.COLUMN_KEY === 'PRI',
        isAutoIncrement: String(c.EXTRA).includes('auto_increment')
      }))

      const info: TableInfo = {
        name: tableName,
        type: isView ? 'view' : 'table',
        columns,
        primaryKey: pks,
        foreignKeys: fkMap.get(tableName) ?? [],
        indexes: [],
        rowCountEstimate: row.TABLE_ROWS != null ? Number(row.TABLE_ROWS) : undefined
      }

      if (isView) views.push(info)
      else tables.push(info)
    }

    return { connectionId: '', tables, views, introspectedAt: '' }
  }

  // ─── SQLite ─────────────────────────────────────────────────────────────────

  private async introspectSqlite(connectionId: string): Promise<DatabaseSchema> {
    const q = (sql: string) =>
      withTimeout(databaseService.executeQuery(connectionId, sql), QUERY_TIMEOUT_MS, 'SQLite query')

    const masterResult = await q(`
      SELECT name, type FROM sqlite_master
      WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)

    const tables: TableInfo[] = []
    const views: TableInfo[] = []

    for (const row of masterResult.rows) {
      const tableName = String(row.name)
      const isView = row.type === 'view'

      assertSafeTableName(tableName)

      const colResult = await q(`PRAGMA table_info("${tableName}")`)

      const pks: string[] = []
      const columns: ColumnInfo[] = colResult.rows.map((c) => {
        const isPk = Number(c.pk) > 0
        if (isPk) pks.push(String(c.name))
        return {
          name: String(c.name),
          type: String(c.type || 'TEXT'),
          nullable: Number(c.notnull) === 0,
          defaultValue: c.dflt_value != null ? String(c.dflt_value) : undefined,
          isPrimaryKey: isPk,
          isAutoIncrement: isPk && /integer/i.test(String(c.type))
        }
      })

      const foreignKeys: ForeignKeyInfo[] = []
      if (!isView) {
        const fkResult = await q(`PRAGMA foreign_key_list("${tableName}")`)
        const fkGroups = new Map<number, { table: string; from: string[]; to: string[] }>()
        for (const fk of fkResult.rows) {
          const id = Number(fk.id)
          if (!fkGroups.has(id)) {
            fkGroups.set(id, { table: String(fk.table), from: [], to: [] })
          }
          fkGroups.get(id)!.from.push(String(fk.from))
          fkGroups.get(id)!.to.push(String(fk.to))
        }
        for (const [, fk] of fkGroups) {
          foreignKeys.push({
            columns: fk.from,
            referencedTable: fk.table,
            referencedColumns: fk.to
          })
        }
      }

      const indexes: IndexInfo[] = []
      if (!isView) {
        const idxResult = await q(`PRAGMA index_list("${tableName}")`)
        for (const idx of idxResult.rows) {
          const idxName = String(idx.name)
          if (idxName.startsWith('sqlite_')) continue
          assertSafeTableName(idxName)
          const idxInfoResult = await q(`PRAGMA index_info("${idxName}")`)
          indexes.push({
            name: idxName,
            columns: idxInfoResult.rows.map((r) => String(r.name)),
            isUnique: Number(idx.unique) === 1
          })
        }
      }

      const info: TableInfo = {
        name: tableName,
        type: isView ? 'view' : 'table',
        columns,
        primaryKey: pks,
        foreignKeys,
        indexes
      }

      if (isView) views.push(info)
      else tables.push(info)
    }

    return { connectionId: '', tables, views, introspectedAt: '' }
  }

  // ─── SQL Server ─────────────────────────────────────────────────────────────

  private async introspectSqlServer(connectionId: string): Promise<DatabaseSchema> {
    const q = (sql: string) =>
      withTimeout(databaseService.executeQuery(connectionId, sql), QUERY_TIMEOUT_MS, 'MSSQL query')

    const tablesResult = await q(`
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)

    const columnsResult = await q(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE,
             CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
    `)

    const pkResult = await q(`
      SELECT tc.TABLE_SCHEMA, tc.TABLE_NAME, kcu.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `)

    const fkResult = await q(`
      SELECT
        fk.name AS constraint_name,
        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS table_schema,
        OBJECT_NAME(fk.parent_object_id) AS table_name,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS referenced_schema,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    `)

    const rowCountResult = await q(`
      SELECT s.name AS schema_name, t.name AS table_name,
             SUM(p.rows) AS row_count
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
      GROUP BY s.name, t.name
    `)

    const pkMap = this.groupBy(pkResult.rows, (r) => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`)
    const colMap = this.groupBy(columnsResult.rows, (r) => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`)
    const fkMap = this.groupByFk(
      fkResult.rows,
      (r) => `${r.table_schema}.${r.table_name}`,
      { colKey: 'column_name', refTable: 'referenced_table', refCol: 'referenced_column', refSchema: 'referenced_schema', name: 'constraint_name' }
    )
    const rowMap = new Map(rowCountResult.rows.map((r) => [`${r.schema_name}.${r.table_name}`, Number(r.row_count)]))

    const tables: TableInfo[] = []
    const views: TableInfo[] = []

    for (const row of tablesResult.rows) {
      const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`
      const isView = String(row.TABLE_TYPE) === 'VIEW'
      const pks = (pkMap.get(key) ?? []).map((r) => String(r.COLUMN_NAME))

      const columns: ColumnInfo[] = (colMap.get(key) ?? []).map((c) => {
        const charLen = c.CHARACTER_MAXIMUM_LENGTH as number | null
        let typeName = String(c.DATA_TYPE)
        if (charLen && charLen > 0 && charLen < 8000) typeName = `${typeName}(${charLen})`

        return {
          name: String(c.COLUMN_NAME),
          type: typeName,
          nullable: c.IS_NULLABLE === 'YES',
          defaultValue: c.COLUMN_DEFAULT ? String(c.COLUMN_DEFAULT) : undefined,
          isPrimaryKey: pks.includes(String(c.COLUMN_NAME)),
          isAutoIncrement: false
        }
      })

      const info: TableInfo = {
        name: String(row.TABLE_NAME),
        schema: String(row.TABLE_SCHEMA),
        type: isView ? 'view' : 'table',
        columns,
        primaryKey: pks,
        foreignKeys: fkMap.get(key) ?? [],
        indexes: [],
        rowCountEstimate: rowMap.get(key)
      }

      if (isView) views.push(info)
      else tables.push(info)
    }

    return { connectionId: '', tables, views, introspectedAt: '' }
  }

  // ─── DDL Context Formatter ──────────────────────────────────────────────────

  private formatAsDDL(schema: DatabaseSchema): string {
    const lines: string[] = []
    lines.push(`-- ${schema.tables.length} tables, ${schema.views.length} views`)
    lines.push('')

    for (const table of schema.tables) {
      const qualifiedName = table.schema ? `${table.schema}.${table.name}` : table.name
      lines.push(`CREATE TABLE ${qualifiedName} (`)

      const colDefs: string[] = table.columns.map((col) => {
        let def = `  ${col.name} ${col.type.toUpperCase()}`
        if (col.isPrimaryKey) def += ' PRIMARY KEY'
        if (col.isAutoIncrement) def += ' AUTO_INCREMENT'
        if (!col.nullable && !col.isPrimaryKey) def += ' NOT NULL'
        if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`

        const fk = table.foreignKeys.find((f) => f.columns.length === 1 && f.columns[0] === col.name)
        if (fk) {
          const refTarget = fk.referencedSchema
            ? `${fk.referencedSchema}.${fk.referencedTable}`
            : fk.referencedTable
          def += ` REFERENCES ${refTarget}(${fk.referencedColumns[0]})`
        }
        return def
      })

      lines.push(colDefs.join(',\n'))
      lines.push(');')
      lines.push('')
    }

    for (const view of schema.views) {
      const qualifiedName = view.schema ? `${view.schema}.${view.name}` : view.name
      const colList = view.columns.map((c) => `${c.name} ${c.type.toUpperCase()}`).join(', ')
      lines.push(`-- VIEW: ${qualifiedName} (${colList})`)
    }

    return lines.join('\n').trim()
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private groupBy(
    rows: Record<string, unknown>[],
    keyFn: (r: Record<string, unknown>) => string
  ): Map<string, Record<string, unknown>[]> {
    const map = new Map<string, Record<string, unknown>[]>()
    for (const row of rows) {
      const key = keyFn(row)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return map
  }

  private groupByFk(
    rows: Record<string, unknown>[],
    keyFn: (r: Record<string, unknown>) => string,
    fieldMap?: { colKey: string; refTable: string; refCol: string; refSchema?: string; name?: string }
  ): Map<string, ForeignKeyInfo[]> {
    const colKey = fieldMap?.colKey ?? 'column_name'
    const refTableKey = fieldMap?.refTable ?? 'referenced_table'
    const refColKey = fieldMap?.refCol ?? 'referenced_column'
    const refSchemaKey = fieldMap?.refSchema ?? 'referenced_schema'
    const nameKey = fieldMap?.name ?? 'constraint_name'

    const grouped = new Map<string, Map<string, { cols: string[]; refCols: string[]; refTable: string; refSchema?: string }>>()

    for (const row of rows) {
      const tableKey = keyFn(row)
      const constraintName = String(row[nameKey] ?? '')

      if (!grouped.has(tableKey)) grouped.set(tableKey, new Map())
      const tableMap = grouped.get(tableKey)!

      if (!tableMap.has(constraintName)) {
        tableMap.set(constraintName, {
          cols: [],
          refCols: [],
          refTable: String(row[refTableKey]),
          refSchema: row[refSchemaKey] ? String(row[refSchemaKey]) : undefined
        })
      }
      const entry = tableMap.get(constraintName)!
      entry.cols.push(String(row[colKey]))
      entry.refCols.push(String(row[refColKey]))
    }

    const result = new Map<string, ForeignKeyInfo[]>()
    for (const [tableKey, constraints] of grouped) {
      const fks: ForeignKeyInfo[] = []
      for (const [name, entry] of constraints) {
        fks.push({
          name: name || undefined,
          columns: entry.cols,
          referencedTable: entry.refTable,
          referencedSchema: entry.refSchema,
          referencedColumns: entry.refCols
        })
      }
      result.set(tableKey, fks)
    }
    return result
  }
}

export const schemaService = new SchemaService()
