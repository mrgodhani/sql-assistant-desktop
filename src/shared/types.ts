// ─── Database Connection Types ───────────────────────────────────────────────

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver'

export const DATABASE_TYPES: DatabaseType[] = ['postgresql', 'mysql', 'sqlite', 'sqlserver']

export const DATABASE_TYPE_LABELS: Record<DatabaseType, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  sqlserver: 'SQL Server'
}

export const DEFAULT_PORTS: Record<Exclude<DatabaseType, 'sqlite'>, number> = {
  postgresql: 5432,
  mysql: 3306,
  sqlserver: 1433
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface DatabaseConnection {
  id: string
  name: string
  type: DatabaseType
  host?: string
  port?: number
  database: string
  username?: string
  hasPassword: boolean
  connectionString?: string
  sslEnabled: boolean
  filePath?: string
  createdAt: string
  updatedAt: string
}

export interface ConnectionConfig {
  name: string
  type: DatabaseType
  host?: string
  port?: number
  database: string
  username?: string
  password?: string
  connectionString?: string
  sslEnabled: boolean
  filePath?: string
  trustSelfSignedCert?: boolean
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  latencyMs?: number
}

export interface ConnectionResult {
  success: boolean
  error?: string
}

// ─── Schema Introspection Types ──────────────────────────────────────────────

export interface DatabaseSchema {
  connectionId: string
  tables: TableInfo[]
  views: TableInfo[]
  introspectedAt: string
}

export interface TableInfo {
  name: string
  schema?: string
  type: 'table' | 'view'
  columns: ColumnInfo[]
  primaryKey: string[]
  foreignKeys: ForeignKeyInfo[]
  indexes: IndexInfo[]
  rowCountEstimate?: number
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  isPrimaryKey: boolean
  isAutoIncrement: boolean
}

export interface ForeignKeyInfo {
  name?: string
  columns: string[]
  referencedTable: string
  referencedSchema?: string
  referencedColumns: string[]
}

export interface IndexInfo {
  name: string
  columns: string[]
  isUnique: boolean
}

export interface SchemaIntrospectionResult {
  success: boolean
  schema?: DatabaseSchema
  error?: string
  tableCount: number
  introspectedAt: string
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
  truncated?: boolean
}

export interface ExecutionResult {
  success: boolean
  result?: QueryResult
  error?: string
  requiresConfirmation?: boolean
  detectedStatements?: string[]
}

export interface SqlValidationResult {
  valid: boolean
  error?: string
}

// ─── Chart & Export Types ────────────────────────────────────────────────────

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area'

export interface ChartConfig {
  chartType: ChartType
  xAxisColumn: string | null
  yAxisColumns: string[]
  labelColumn: string | null
}

export interface ReportExportOptions {
  title: string
  logoPath?: string
  includeChart: boolean
  chartImageBase64?: string
}

// ─── AI Chat Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIChatParams {
  provider: AIProvider
  model: string
  messages: ChatMessage[]
  schemaContext?: string
  databaseType?: DatabaseType
  connectionName?: string
  requestId: string
  /** When set, used instead of buildSystemPrompt(schemaContext, databaseType, connectionName) */
  systemPromptOverride?: string
}

export interface StreamChunk {
  requestId: string
  chunk: string
  done: boolean
  error?: string
}

export type AIErrorType =
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'token_limit'
  | 'model_not_found'
  | 'cancelled'
  | 'unknown'

export interface Conversation {
  id: string
  title: string
  connectionId: string | null
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ConversationSummary {
  id: string
  title: string
  connectionId: string | null
  updatedAt: string
}

export interface StreamingState {
  requestId: string
  messageIndex: number
  accumulatedContent: string
}

// ─── AI Provider Types ───────────────────────────────────────────────────────

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama'

export const AI_PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'google', 'openrouter', 'ollama']

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
  ollama: 'Ollama'
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  models: string[]
  selectedModel: string
  enabled: boolean
}

export interface ValidationResult {
  valid: boolean
  message: string
}

export type ThemeMode = 'system' | 'dark' | 'light'

export interface AppSettings {
  theme: ThemeMode
  activeProvider: AIProvider
  activeModel: string
  providerConfigs: Record<AIProvider, ProviderConfig>
}

export const DEFAULT_PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    selectedModel: 'gpt-4o-mini',
    enabled: false
  },
  anthropic: {
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    selectedModel: 'claude-sonnet-4-20250514',
    enabled: false
  },
  google: {
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    selectedModel: 'gemini-2.0-flash',
    enabled: false
  },
  openrouter: {
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4-20250514',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.1-70b-instruct'
    ],
    selectedModel: 'openai/gpt-4o',
    enabled: false
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    models: ['llama3.2', 'codellama', 'mistral', 'gemma2'],
    selectedModel: 'llama3.2',
    enabled: true
  }
}

// ─── Schema Designer Types ──────────────────────────────────────────────────

export interface SchemaDesign {
  version: 1
  dialect: DatabaseType
  tables: TableDesign[]
  enums?: EnumDesign[]
}

export interface TableDesign {
  name: string
  schema?: string
  columns: ColumnDesign[]
  primaryKey: string[]
  indexes?: IndexDesign[]
  comment?: string
}

export interface ColumnDesign {
  name: string
  type: string
  nullable: boolean
  default?: string
  unique?: boolean
  foreignKey?: ForeignKeyDesign
  comment?: string
}

export interface ForeignKeyDesign {
  table: string
  column: string
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

export interface IndexDesign {
  name: string
  columns: string[]
  unique: boolean
}

export interface EnumDesign {
  name: string
  values: string[]
}

export interface SchemaDesignChangelog {
  schema: SchemaDesign
  changelog: string[]
}

export interface SchemaValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface DDLResult {
  statements: string[]
  dialect: DatabaseType
}

export interface DDLExecutionResult {
  success: boolean
  results: Array<{ statement: string; success: boolean; error?: string }>
}

export type SchemaAgentTool =
  | 'introspect_database'
  | 'propose_schema'
  | 'generate_ddl'
  | 'execute_ddl'
  | 'validate_schema'
  | 'filter_view'

export interface SchemaAgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: SchemaAgentToolCall[]
  toolCallId?: string
}

export interface SchemaAgentToolCall {
  id: string
  name: SchemaAgentTool
  arguments: Record<string, unknown>
}

export interface SchemaAgentStreamChunk {
  sessionId: string
  type:
    | 'text'
    | 'tool_call'
    | 'tool_result'
    | 'schema_updated'
    | 'ddl_approval'
    | 'filter_changed'
    | 'done'
    | 'error'
  content?: string
  toolCall?: SchemaAgentToolCall
  toolResult?: unknown
  schema?: SchemaDesign
  changelog?: string[]
  ddlStatements?: string[]
  filteredTables?: string[] | null
  error?: string
}

export interface SchemaAgentChatParams {
  sessionId: string
  message: string
  connectionId?: string
  provider: AIProvider
  model: string
}

export interface SchemaDesignSession {
  id: string
  dialect: DatabaseType
  connectionId?: string
  schema: SchemaDesign | null
  history: SchemaDesign[]
}
