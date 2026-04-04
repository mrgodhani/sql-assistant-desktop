/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHandle = vi.fn()
vi.mock('electron', () => ({
  ipcMain: { handle: (...args: unknown[]) => mockHandle(...args) }
}))
vi.mock('electron-log/main', () => ({
  default: { error: vi.fn() }
}))

const mockGenerateDesignerSchema = vi.fn()
vi.mock('../../services/ai.service', () => ({
  aiService: { generateDesignerSchema: (...args: unknown[]) => mockGenerateDesignerSchema(...args) }
}))

const mockGenerateDDL = vi.fn()
vi.mock('../../lib/designer-ddl', () => ({
  generateDDL: (...args: unknown[]) => mockGenerateDDL(...args)
}))

import { registerDesignerIpc } from '../designer.ipc'

describe('designer IPC handler', () => {
  beforeEach(() => {
    mockHandle.mockReset()
    mockGenerateDesignerSchema.mockReset()
    mockGenerateDDL.mockReset()
    registerDesignerIpc()
  })

  function getHandler(channel: string) {
    const call = mockHandle.mock.calls.find((c) => c[0] === channel)
    if (!call) throw new Error(`No handler registered for ${channel}`)
    return call[1] as (_event: null, ...args: unknown[]) => Promise<unknown>
  }

  describe('designer:generate-schema', () => {
    it('returns error when prompt is empty string', async () => {
      const handler = getHandler('designer:generate-schema')
      await expect(handler(null, '')).rejects.toThrow()
    })

    it('returns error when prompt is not a string', async () => {
      const handler = getHandler('designer:generate-schema')
      await expect(handler(null, 42)).rejects.toThrow()
    })

    it('calls aiService.generateDesignerSchema with valid prompt', async () => {
      mockGenerateDesignerSchema.mockResolvedValue({ success: true, schema: { tables: [], relationships: [] } })
      const handler = getHandler('designer:generate-schema')
      const result = await handler(null, 'A blog with users and posts')
      expect(mockGenerateDesignerSchema).toHaveBeenCalledWith('A blog with users and posts')
      expect(result).toEqual({ success: true, schema: { tables: [], relationships: [] } })
    })
  })

  describe('designer:generate-ddl', () => {
    it('returns error when payload is malformed JSON', async () => {
      const handler = getHandler('designer:generate-ddl')
      await expect(handler(null, 'not-json')).rejects.toThrow()
    })

    it('returns error when payload has no tables array', async () => {
      const handler = getHandler('designer:generate-ddl')
      await expect(handler(null, JSON.stringify({ foo: 'bar' }))).rejects.toThrow()
    })

    it('calls generateDDL with valid schema payload', async () => {
      const schema = { tables: [], relationships: [] }
      mockGenerateDDL.mockReturnValue({ success: true, ddl: '' })
      const handler = getHandler('designer:generate-ddl')
      const result = await handler(null, JSON.stringify(schema))
      expect(mockGenerateDDL).toHaveBeenCalledWith(schema)
      expect(result).toEqual({ success: true, ddl: '' })
    })
  })
})
