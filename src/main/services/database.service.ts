import { randomUUID } from 'crypto'
import { dialog } from 'electron'
import log from 'electron-log/main'
import { eq } from 'drizzle-orm'
import pg from 'pg'
import mysql2 from 'mysql2/promise'
import mssql from 'mssql'
import BetterSqlite3 from 'better-sqlite3'
import { getDatabase, schema } from '../db'
import { encryptionService } from './encryption.service'
import type {
  DatabaseType,
  DatabaseConnection,
  ConnectionConfig,
  ConnectionTestResult,
  ConnectionResult,
  QueryResult
} from '../../shared/types'
import { DEFAULT_PORTS } from '../../shared/types'

type PoolHandle =
  | { type: 'postgresql'; pool: pg.Pool }
  | { type: 'mysql'; pool: mysql2.Pool }
  | { type: 'sqlserver'; pool: mssql.ConnectionPool }
  | { type: 'sqlite'; pool: BetterSqlite3.Database }

const CONNECTION_TIMEOUT_MS = 10_000

function sanitizeConnectionError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)

  if (msg.includes('ECONNREFUSED')) return 'Could not connect to server. Check host and port.'
  if (msg.includes('ETIMEDOUT') || msg.includes('timed out'))
    return 'Connection timed out. Server may be unreachable.'
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo'))
    return 'Host not found. Check the hostname.'
  if (/authentication|password|login/i.test(msg))
    return 'Authentication failed. Check username and password.'
  if (/database.*not exist|unknown database/i.test(msg))
    return 'Database not found. Check the database name.'
  if (/ssl|tls|certificate/i.test(msg)) return 'SSL connection failed. Check SSL settings.'
  if (/SQLITE_CANTOPEN/i.test(msg)) return 'Cannot open database file. Check the file path.'

  return 'Connection failed. Please verify your settings.'
}

export function parseConnectionString(
  connStr: string
): Partial<ConnectionConfig> & { type?: DatabaseType } {
  const trimmed = connStr.trim()

  let type: DatabaseType | undefined
  if (/^(postgresql|postgres):\/\//i.test(trimmed)) type = 'postgresql'
  else if (/^mysql:\/\//i.test(trimmed)) type = 'mysql'
  else if (/^(mssql|sqlserver):\/\//i.test(trimmed)) type = 'sqlserver'
  else if (/^sqlite:\/\//i.test(trimmed)) {
    type = 'sqlite'
    const filePath = trimmed.replace(/^sqlite:\/\/\/?/, '')
    return { type, filePath, database: filePath }
  }

  if (!type) throw new Error('Unknown connection string format')

  const url = new URL(trimmed)
  return {
    type,
    host: url.hostname || 'localhost',
    port: url.port ? parseInt(url.port) : DEFAULT_PORTS[type],
    database: url.pathname.replace(/^\//, ''),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined
  }
}

export function buildConnectionString(config: ConnectionConfig): string {
  if (config.type === 'sqlite') return `sqlite:///${config.filePath || config.database}`

  const protocolMap: Record<string, string> = {
    postgresql: 'postgresql',
    mysql: 'mysql',
    sqlserver: 'mssql'
  }
  const protocol = protocolMap[config.type] || config.type
  const auth = config.username ? `${config.username}:***@` : ''
  const port = config.port || DEFAULT_PORTS[config.type as Exclude<DatabaseType, 'sqlite'>]
  return `${protocol}://${auth}${config.host || 'localhost'}:${port}/${config.database}`
}

class DatabaseService {
  private pools: Map<string, PoolHandle> = new Map()

  async listConnections(): Promise<DatabaseConnection[]> {
    const db = getDatabase()
    const rows = db.select().from(schema.connections).all()
    return rows.map((r) => this.toConnectionDto(r))
  }

  async getConnection(id: string): Promise<DatabaseConnection | null> {
    const db = getDatabase()
    const row = db.select().from(schema.connections).where(eq(schema.connections.id, id)).get()
    if (!row) return null
    return this.toConnectionDto(row)
  }

  async createConnection(config: ConnectionConfig): Promise<DatabaseConnection> {
    this.validateConfig(config)
    await this.checkNameUnique(config.name)

    const db = getDatabase()
    const id = randomUUID()
    const now = new Date().toISOString()

    const passwordEncrypted = config.password ? encryptionService.encrypt(config.password) : null
    const connStringEncrypted = config.connectionString
      ? encryptionService.encrypt(config.connectionString)
      : null

    db.insert(schema.connections)
      .values({
        id,
        name: config.name.trim(),
        type: config.type,
        host: config.host?.trim() || null,
        port: config.port || null,
        database: config.database.trim(),
        username: config.username?.trim() || null,
        passwordEncrypted,
        connectionStringEncrypted: connStringEncrypted,
        sslEnabled: config.sslEnabled,
        filePath: config.filePath?.trim() || null,
        createdAt: now,
        updatedAt: now
      })
      .run()

    return (await this.getConnection(id))!
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<DatabaseConnection> {
    this.validateConfig(config)
    await this.checkNameUnique(config.name, id)

    if (this.pools.has(id)) {
      await this.disconnect(id)
    }

    const db = getDatabase()
    const now = new Date().toISOString()

    const passwordEncrypted = config.password ? encryptionService.encrypt(config.password) : null
    const connStringEncrypted = config.connectionString
      ? encryptionService.encrypt(config.connectionString)
      : null

    db.update(schema.connections)
      .set({
        name: config.name.trim(),
        type: config.type,
        host: config.host?.trim() || null,
        port: config.port || null,
        database: config.database.trim(),
        username: config.username?.trim() || null,
        passwordEncrypted,
        connectionStringEncrypted: connStringEncrypted,
        sslEnabled: config.sslEnabled,
        filePath: config.filePath?.trim() || null,
        updatedAt: now
      })
      .where(eq(schema.connections.id, id))
      .run()

    return (await this.getConnection(id))!
  }

  async deleteConnection(id: string): Promise<void> {
    if (this.pools.has(id)) {
      await this.disconnect(id)
    }
    const db = getDatabase()
    db.delete(schema.connections).where(eq(schema.connections.id, id)).run()
  }

  async connect(id: string): Promise<ConnectionResult> {
    const db = getDatabase()
    const row = db.select().from(schema.connections).where(eq(schema.connections.id, id)).get()

    if (!row) return { success: false, error: 'Connection not found' }

    const password = row.passwordEncrypted
      ? encryptionService.decrypt(row.passwordEncrypted, true)
      : undefined

    try {
      const handle = await this.createPool(row, password)
      this.pools.set(id, handle)
      return { success: true }
    } catch (error) {
      log.error(
        `[Database] Connection failed for "${row.name}":`,
        sanitizeConnectionError(error)
      )
      return { success: false, error: sanitizeConnectionError(error) }
    }
  }

  async disconnect(id: string): Promise<void> {
    const handle = this.pools.get(id)
    if (!handle) return

    try {
      await this.closePool(handle)
    } catch (error) {
      log.error(
        '[Database] Error closing pool:',
        error instanceof Error ? error.message : error
      )
    }
    this.pools.delete(id)
  }

  async disconnectAll(): Promise<void> {
    const ids = [...this.pools.keys()]
    for (const id of ids) {
      await this.disconnect(id)
    }
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = Date.now()

    try {
      const row = {
        type: config.type,
        host: config.host || null,
        port: config.port || null,
        database: config.database,
        username: config.username || null,
        sslEnabled: config.sslEnabled ?? false,
        filePath: config.filePath || null
      }

      const handle = await this.createPool(
        row as typeof schema.connections.$inferSelect,
        config.password
      )
      await this.closePool(handle)

      const latencyMs = Date.now() - start
      return { success: true, message: 'Connection successful', latencyMs }
    } catch (error) {
      return { success: false, message: sanitizeConnectionError(error) }
    }
  }

  async pickSqliteFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'createDirectory'],
      filters: [
        { name: 'SQLite Databases', extensions: ['db', 'sqlite', 'sqlite3', 's3db'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  }

  private static readonly ROW_LIMIT = 100_000

  private applyRowLimit(result: QueryResult): QueryResult {
    if (result.rows.length <= DatabaseService.ROW_LIMIT) return result
    return {
      columns: result.columns,
      rows: result.rows.slice(0, DatabaseService.ROW_LIMIT),
      rowCount: DatabaseService.ROW_LIMIT,
      executionTimeMs: result.executionTimeMs,
      truncated: true
    }
  }

  async executeQuery(connectionId: string, sql: string): Promise<QueryResult> {
    const handle = this.pools.get(connectionId)
    if (!handle) throw new Error('Connection is not active')

    const start = Date.now()

    switch (handle.type) {
      case 'postgresql': {
        const result = await handle.pool.query(sql)
        const qr: QueryResult = {
          columns: result.fields.map((f) => f.name),
          rows: result.rows as Record<string, unknown>[],
          rowCount: result.rowCount ?? result.rows.length,
          executionTimeMs: Date.now() - start
        }
        return this.applyRowLimit(qr)
      }

      case 'mysql': {
        const [rows, fields] = await handle.pool.query(sql)
        const rowArray = Array.isArray(rows) ? rows : [rows]
        const qr: QueryResult = {
          columns: Array.isArray(fields) ? fields.map((f) => f.name) : [],
          rows: rowArray as Record<string, unknown>[],
          rowCount: rowArray.length,
          executionTimeMs: Date.now() - start
        }
        return this.applyRowLimit(qr)
      }

      case 'sqlserver': {
        const result = await handle.pool.request().query(sql)
        const columns = result.recordset.columns
          ? Object.keys(result.recordset.columns)
          : result.recordset.length > 0
            ? Object.keys(result.recordset[0])
            : []
        const qr: QueryResult = {
          columns,
          rows: result.recordset as Record<string, unknown>[],
          rowCount: result.recordset.length,
          executionTimeMs: Date.now() - start
        }
        return this.applyRowLimit(qr)
      }

      case 'sqlite': {
        const stmt = handle.pool.prepare(sql)
        const rows = stmt.all() as Record<string, unknown>[]
        const columns = rows.length > 0 ? Object.keys(rows[0]) : []
        const qr: QueryResult = {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: Date.now() - start
        }
        return this.applyRowLimit(qr)
      }
    }
  }

  getConnectionType(connectionId: string): DatabaseType | null {
    const handle = this.pools.get(connectionId)
    if (!handle) return null
    return handle.type as DatabaseType
  }

  isConnected(id: string): boolean {
    return this.pools.has(id)
  }

  getConnectedIds(): string[] {
    return [...this.pools.keys()]
  }

  private async createPool(
    row: {
      type: string
      host: string | null
      port: number | null
      database: string
      username: string | null
      sslEnabled: boolean | null
      filePath: string | null
    },
    password?: string
  ): Promise<PoolHandle> {
    const dbType = row.type as DatabaseType

    switch (dbType) {
      case 'postgresql': {
        const pool = new pg.Pool({
          host: row.host || 'localhost',
          port: row.port || DEFAULT_PORTS.postgresql,
          database: row.database,
          user: row.username || undefined,
          password: password || undefined,
          ssl: row.sslEnabled ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS
        })
        await pool.query('SELECT 1')
        return { type: 'postgresql', pool }
      }

      case 'mysql': {
        const pool = mysql2.createPool({
          host: row.host || 'localhost',
          port: row.port || DEFAULT_PORTS.mysql,
          database: row.database,
          user: row.username || undefined,
          password: password || undefined,
          ssl: row.sslEnabled ? {} : undefined,
          connectTimeout: CONNECTION_TIMEOUT_MS
        })
        await pool.query('SELECT 1')
        return { type: 'mysql', pool }
      }

      case 'sqlserver': {
        const pool = new mssql.ConnectionPool({
          server: row.host || 'localhost',
          port: row.port || DEFAULT_PORTS.sqlserver,
          database: row.database,
          user: row.username || undefined,
          password: password || undefined,
          options: {
            encrypt: row.sslEnabled ?? false,
            trustServerCertificate: true
          },
          connectionTimeout: CONNECTION_TIMEOUT_MS
        })
        await pool.connect()
        await pool.request().query('SELECT 1')
        return { type: 'sqlserver', pool }
      }

      case 'sqlite': {
        const filePath = row.filePath || row.database
        const db = new BetterSqlite3(filePath)
        db.pragma('journal_mode = WAL')
        return { type: 'sqlite', pool: db }
      }

      default:
        throw new Error(`Unsupported database type: ${dbType}`)
    }
  }

  private async closePool(handle: PoolHandle): Promise<void> {
    switch (handle.type) {
      case 'postgresql':
        await handle.pool.end()
        break
      case 'mysql':
        await handle.pool.end()
        break
      case 'sqlserver':
        await handle.pool.close()
        break
      case 'sqlite':
        handle.pool.close()
        break
    }
  }

  private toConnectionDto(row: typeof schema.connections.$inferSelect): DatabaseConnection {
    return {
      id: row.id,
      name: row.name,
      type: row.type as DatabaseType,
      host: row.host ?? undefined,
      port: row.port ?? undefined,
      database: row.database,
      username: row.username ?? undefined,
      hasPassword: Boolean(row.passwordEncrypted),
      sslEnabled: row.sslEnabled ?? false,
      filePath: row.filePath ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  private validateConfig(config: ConnectionConfig): void {
    if (!config.name?.trim()) throw new Error('Connection name is required')
    if (config.name.length > 100) throw new Error('Connection name must be 100 characters or less')

    if (config.type === 'sqlite') {
      if (!config.filePath?.trim() && !config.database?.trim())
        throw new Error('Database file path is required for SQLite')
    } else {
      if (!config.host?.trim()) throw new Error('Host is required')
      if (!config.database?.trim()) throw new Error('Database name is required')
      if (config.port && (config.port < 1 || config.port > 65535))
        throw new Error('Port must be between 1 and 65535')
    }
  }

  private async checkNameUnique(name: string, excludeId?: string): Promise<void> {
    const db = getDatabase()
    const rows = db.select().from(schema.connections).all()
    const duplicate = rows.find(
      (r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== excludeId
    )
    if (duplicate) throw new Error('A connection with this name already exists')
  }
}

export const databaseService = new DatabaseService()
