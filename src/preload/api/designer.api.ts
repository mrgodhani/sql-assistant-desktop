import { ipcRenderer } from 'electron'
import type { DesignerGenerateResult, DesignerDDLResult, DesignerSchema } from '../../shared/types'

export const designerApi = {
  generateSchema: (prompt: string): Promise<DesignerGenerateResult> =>
    ipcRenderer.invoke('designer:generate-schema', prompt),

  generateDDL: (schema: DesignerSchema): Promise<DesignerDDLResult> =>
    ipcRenderer.invoke('designer:generate-ddl', JSON.stringify(schema)),

  writeDDL: (filePath: string, content: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('designer:write-ddl', JSON.stringify({ filePath, content }))
}
