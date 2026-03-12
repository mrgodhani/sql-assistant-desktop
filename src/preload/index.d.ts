import type {
  AIProvider,
  AppSettings,
  ProviderConfig,
  ThemeMode,
  ValidationResult,
  DatabaseConnection,
  ConnectionConfig,
  ConnectionTestResult,
  ConnectionResult,
  SchemaIntrospectionResult,
  AIChatParams,
  StreamChunk,
  ExecutionResult,
  SqlValidationResult
} from '../shared/types'

interface SettingsApi {
  getAll: () => Promise<AppSettings>
  getTheme: () => Promise<ThemeMode>
  setTheme: (theme: ThemeMode) => Promise<void>
  getSystemTheme: () => Promise<'dark' | 'light'>
  onSystemThemeChange: (callback: (theme: 'dark' | 'light') => void) => () => void
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  getProviderConfig: (provider: AIProvider) => Promise<ProviderConfig>
  setProviderConfig: (provider: AIProvider, config: Partial<ProviderConfig>) => Promise<void>
  validateApiKey: (provider: AIProvider, apiKey: string) => Promise<ValidationResult>
  fetchOllamaModels: (baseUrl: string) => Promise<string[]>
}

interface ConnectionsApi {
  list: () => Promise<DatabaseConnection[]>
  get: (id: string) => Promise<DatabaseConnection | null>
  create: (config: ConnectionConfig) => Promise<DatabaseConnection>
  update: (id: string, config: ConnectionConfig) => Promise<DatabaseConnection>
  delete: (id: string) => Promise<void>
  connect: (id: string) => Promise<ConnectionResult>
  disconnect: (id: string) => Promise<void>
  test: (config: ConnectionConfig) => Promise<ConnectionTestResult>
  pickSqliteFile: () => Promise<string | null>
}

interface SchemaApi {
  introspect: (connectionId: string) => Promise<SchemaIntrospectionResult>
  refresh: (connectionId: string) => Promise<SchemaIntrospectionResult>
  getContext: (connectionId: string) => Promise<string>
  search: (connectionId: string, query: string) => Promise<Array<{ table: string; column: string }>>
}

interface AiApi {
  chatStream: (params: AIChatParams) => Promise<{ requestId: string }>
  cancel: (requestId: string) => void
  listModels: (provider: AIProvider) => Promise<string[]>
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => void
  offStreamChunk: () => void
}

interface DbApi {
  execute: (connectionId: string, sql: string) => Promise<ExecutionResult>
  executeConfirmed: (connectionId: string, sql: string) => Promise<ExecutionResult>
  validateSql: (connectionId: string, sql: string) => Promise<SqlValidationResult>
}

interface ConversationApi {
  list: () => Promise<import('../shared/types').ConversationSummary[]>
  get: (id: string) => Promise<import('../shared/types').Conversation | null>
  create: (connectionId?: string | null) => Promise<import('../shared/types').Conversation>
  updateTitle: (id: string, title: string) => Promise<void>
  delete: (id: string) => Promise<void>
  truncate: (conversationId: string, fromIndex: number) => Promise<void>
  addMessage: (
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ) => Promise<string>
  addGeneratedQuery: (
    messageId: string,
    sql: string,
    metadata?: { executed?: boolean; executionTimeMs?: number; rowCount?: number; error?: string }
  ) => Promise<void>
}

interface LogsApi {
  getLogPath: () => Promise<string>
  getRecentLogs: (lines?: number) => Promise<string>
  openLogFolder: () => Promise<void>
}

interface ExportApi {
  showOpenDialog: (optionsJson: string) => Promise<string | null>
  showSaveDialog: (optionsJson: string) => Promise<string | null>
  exportCsv: (payload: string) => Promise<void>
  exportExcel: (payload: string) => Promise<void>
  exportExcelReport: (payload: string) => Promise<void>
}

interface AppApi {
  settings: SettingsApi
}

interface MinimalElectronBridge {
  platform: 'darwin' | 'win32' | 'linux'
  versions: { electron: string; chrome: string }
}

declare global {
  interface Window {
    electron: MinimalElectronBridge
    api: AppApi
    connectionsApi: ConnectionsApi
    schemaApi: SchemaApi
    aiApi: AiApi
    dbApi: DbApi
    conversationApi: ConversationApi
    exportApi: ExportApi
    logsApi: LogsApi
    platformApi: { getPlatform: () => 'darwin' | 'win32' | 'linux' }
  }
}
