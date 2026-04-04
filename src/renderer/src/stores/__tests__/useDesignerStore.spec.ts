import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { DesignerSchema } from '../../../../../shared/types'

const mockGenerateSchema = vi.fn()
const mockGenerateDDL = vi.fn()
const mockClipboardWrite = vi.fn()
const mockConfirm = vi.fn()

vi.stubGlobal('window', {
  designerApi: {
    generateSchema: (...args: unknown[]) => mockGenerateSchema(...args),
    generateDDL: (...args: unknown[]) => mockGenerateDDL(...args)
  },
  exportApi: { showSaveDialog: vi.fn() },
  confirm: (...args: unknown[]) => mockConfirm(...args)
})
vi.stubGlobal('navigator', { clipboard: { writeText: (...args: unknown[]) => mockClipboardWrite(...args) } })
vi.stubGlobal('crypto', { randomUUID: () => `uuid-${Math.random()}` })

vi.mock('dagre', () => ({
  default: {
    graphlib: { Graph: class { setDefaultEdgeLabel = vi.fn(); setGraph = vi.fn(); setNode = vi.fn(); setEdge = vi.fn(); node = () => ({ x: 0, y: 0, height: 100 }) } },
    layout: vi.fn()
  }
}))

import { useDesignerStore } from '../useDesignerStore'

const fixtureSchema: DesignerSchema = {
  tables: [
    { id: 'tbl-1', name: 'users', columns: [{ id: 'col-1', name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }] },
    { id: 'tbl-2', name: 'posts', columns: [{ id: 'col-2', name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }] }
  ],
  relationships: []
}

describe('useDesignerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGenerateSchema.mockReset()
    mockGenerateDDL.mockReset()
    mockClipboardWrite.mockReset()
    mockConfirm.mockReset()
  })

  // ─── generateFromPrompt ──────────────────────────────────────────────────

  it('populates tables and sets positions when canvas is empty', async () => {
    mockGenerateSchema.mockResolvedValue({ success: true, schema: fixtureSchema })
    const store = useDesignerStore()
    await store.generateFromPrompt('A blog')
    expect(store.tables).toHaveLength(2)
    expect(store.tables[0].name).toBe('users')
  })

  it('sets generateError when API returns success: false', async () => {
    mockGenerateSchema.mockResolvedValue({ success: false, error: 'Parse failed' })
    const store = useDesignerStore()
    await store.generateFromPrompt('A blog')
    expect(store.generateError).toBe('Parse failed')
    expect(store.tables).toHaveLength(0)
  })

  it('calls window.confirm when canvas is non-empty', async () => {
    mockConfirm.mockReturnValue(false)
    const store = useDesignerStore()
    store.addTable()
    await store.generateFromPrompt('A blog')
    expect(mockConfirm).toHaveBeenCalledWith('This will replace the current canvas. Continue?')
  })

  it('does not call API when user cancels confirm', async () => {
    mockConfirm.mockReturnValue(false)
    const store = useDesignerStore()
    store.addTable()
    await store.generateFromPrompt('A blog')
    expect(mockGenerateSchema).not.toHaveBeenCalled()
  })

  it('replaces state when user confirms', async () => {
    mockConfirm.mockReturnValue(true)
    mockGenerateSchema.mockResolvedValue({ success: true, schema: fixtureSchema })
    const store = useDesignerStore()
    store.addTable()
    await store.generateFromPrompt('A blog')
    expect(store.tables).toHaveLength(2)
    expect(store.tables[0].name).toBe('users')
  })

  // ─── clearCanvas ─────────────────────────────────────────────────────────

  it('clearCanvas resets all state', async () => {
    mockGenerateSchema.mockResolvedValue({ success: true, schema: fixtureSchema })
    const store = useDesignerStore()
    await store.generateFromPrompt('A blog')
    store.clearCanvas()
    expect(store.tables).toHaveLength(0)
    expect(store.relationships).toHaveLength(0)
    expect(store.generateError).toBeNull()
    expect(store.selectedNodeId).toBeNull()
    expect(store.selectedEdgeId).toBeNull()
  })

  // ─── selectNode / clearSelection ─────────────────────────────────────────

  it('selectNode sets selectedNodeId', () => {
    const store = useDesignerStore()
    store.selectNode('node-abc')
    expect(store.selectedNodeId).toBe('node-abc')
  })

  it('clearSelection sets both selectedNodeId and selectedEdgeId to null', () => {
    const store = useDesignerStore()
    store.selectNode('node-abc')
    store.selectEdge('edge-xyz')
    store.clearSelection()
    expect(store.selectedNodeId).toBeNull()
    expect(store.selectedEdgeId).toBeNull()
  })

  // ─── Column CRUD ──────────────────────────────────────────────────────────

  it('addColumn appends to correct table', () => {
    const store = useDesignerStore()
    store.addTable()
    const tableId = store.tables[0].id
    store.addColumn(tableId, { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false })
    const table = store.tables.find((t) => t.id === tableId)
    expect(table?.columns.some((c) => c.name === 'email')).toBe(true)
  })

  it('updateColumn patches the right field', () => {
    const store = useDesignerStore()
    store.addTable()
    const tableId = store.tables[0].id
    const colId = store.tables[0].columns[0].id
    store.updateColumn(tableId, colId, { name: 'pk_id' })
    expect(store.tables[0].columns[0].name).toBe('pk_id')
  })

  it('removeColumn removes the column', () => {
    const store = useDesignerStore()
    store.addTable()
    const tableId = store.tables[0].id
    store.addColumn(tableId, { name: 'email', type: 'TEXT', nullable: true, isPrimaryKey: false })
    const colId = store.tables[0].columns[1].id
    store.removeColumn(tableId, colId)
    expect(store.tables[0].columns).toHaveLength(1)
  })

  it('removeTable also removes related relationships', () => {
    const store = useDesignerStore()
    store.addTable()
    store.addTable()
    const t1 = store.tables[0].id
    const t2 = store.tables[1].id
    store.addRelationship({ source: t1, target: t2, sourceHandle: null, targetHandle: null })
    store.removeTable(t1)
    expect(store.relationships).toHaveLength(0)
  })

  it('addTable inserts with default id column at given position', () => {
    const store = useDesignerStore()
    store.addTable({ x: 200, y: 300 })
    const tableId = store.tables[0].id
    expect(store.positions[tableId]).toEqual({ x: 200, y: 300 })
    expect(store.tables[0].columns[0].isPrimaryKey).toBe(true)
  })
})
