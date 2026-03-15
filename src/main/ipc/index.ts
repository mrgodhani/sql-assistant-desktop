import { registerSettingsIpc } from './settings.ipc'
import { registerConnectionsIpc } from './connections.ipc'
import { registerSchemaIpc } from './schema.ipc'
import { registerAiIpc } from './ai.ipc'
import { registerDatabaseIpc } from './database.ipc'
import { registerConversationIpc } from './conversation.ipc'
import { registerExportIpc } from './export.ipc'
import { registerLogsIpc } from './logs.ipc'
import { registerExplainIpc } from './explain.ipc'
import { registerSchemaAgentIpc } from './schema-agent.ipc'

export function registerAllIpc(): void {
  registerSettingsIpc()
  registerConnectionsIpc()
  registerSchemaIpc()
  registerAiIpc()
  registerDatabaseIpc()
  registerConversationIpc()
  registerExportIpc()
  registerLogsIpc()
  registerExplainIpc()
  registerSchemaAgentIpc()
}
