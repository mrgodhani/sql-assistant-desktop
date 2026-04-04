import { writeFile } from 'node:fs/promises'
import { handleValidated, assertString } from '../lib/ipc-validator'
import { aiService } from '../services/ai.service'
import { generateDDL } from '../lib/designer-ddl'
import type { DesignerSchema } from '../../shared/types'

export function registerDesignerIpc(): void {
  handleValidated(
    'designer:generate-schema',
    (prompt) => assertString(prompt, 'prompt'),
    async (prompt) => aiService.generateDesignerSchema(prompt)
  )

  handleValidated(
    'designer:generate-ddl',
    (payload) => {
      const raw = assertString(payload, 'schema payload')
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error('schema payload must be valid JSON')
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as Record<string, unknown>).tables)
      ) {
        throw new Error('schema payload must have a tables array')
      }
      return parsed as DesignerSchema
    },
    async (schema) => generateDDL(schema)
  )

  handleValidated(
    'designer:write-ddl',
    (payload) => {
      const raw = assertString(payload, 'write payload')
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error('write payload must be valid JSON')
      }
      const obj = parsed as Record<string, unknown>
      if (typeof obj.filePath !== 'string' || !obj.filePath) throw new Error('filePath is required')
      if (typeof obj.content !== 'string') throw new Error('content is required')
      return { filePath: obj.filePath, content: obj.content }
    },
    async ({ filePath, content }) => {
      await writeFile(filePath, content, 'utf-8')
      return { success: true }
    }
  )
}
