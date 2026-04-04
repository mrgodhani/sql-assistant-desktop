import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dagre from 'dagre'
import type { Node, Edge, Connection } from '@vue-flow/core'
import type {
  DesignerTable,
  DesignerRelationship,
  DesignerColumn
} from '../../../shared/types'

const NODE_WIDTH = 260
const NODE_HEADER_HEIGHT = 40
const COLUMN_ROW_HEIGHT = 28
const NODE_PADDING = 16

export const useDesignerStore = defineStore('designer', () => {
  const tables = ref<DesignerTable[]>([])
  const relationships = ref<DesignerRelationship[]>([])
  const positions = ref<Record<string, { x: number; y: number }>>({})
  const generating = ref(false)
  const generateError = ref<string | null>(null)
  const selectedNodeId = ref<string | null>(null)
  const selectedEdgeId = ref<string | null>(null)

  // ─── Layout ──────────────────────────────────────────────────────────────

  function autoLayout(): void {
    if (tables.value.length === 0) return

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 })

    for (const table of tables.value) {
      const height = NODE_HEADER_HEIGHT + table.columns.length * COLUMN_ROW_HEIGHT + NODE_PADDING
      g.setNode(table.id, { width: NODE_WIDTH, height })
    }
    for (const rel of relationships.value) {
      g.setEdge(rel.fromTableId, rel.toTableId)
    }

    dagre.layout(g)

    const newPositions: Record<string, { x: number; y: number }> = {}
    for (const table of tables.value) {
      const pos = g.node(table.id)
      if (pos) {
        newPositions[table.id] = { x: pos.x - NODE_WIDTH / 2, y: pos.y - pos.height / 2 }
      }
    }
    positions.value = { ...positions.value, ...newPositions }
  }

  // ─── Generation ──────────────────────────────────────────────────────────

  async function generateFromPrompt(prompt: string): Promise<void> {
    if (tables.value.length > 0) {
      const confirmed = window.confirm('This will replace the current canvas. Continue?')
      if (!confirmed) return
    }

    generating.value = true
    generateError.value = null

    try {
      const result = await window.designerApi.generateSchema(prompt)
      if (result.success && result.schema) {
        tables.value = result.schema.tables
        relationships.value = result.schema.relationships
        positions.value = {}
        autoLayout()
      } else {
        generateError.value = result.error ?? 'Generation failed. Try rephrasing your description.'
      }
    } catch (err) {
      generateError.value = err instanceof Error ? err.message : 'An unexpected error occurred.'
    } finally {
      generating.value = false
    }
  }

  // ─── Table CRUD ──────────────────────────────────────────────────────────

  function addTable(position?: { x: number; y: number }): void {
    const id = crypto.randomUUID()
    const table: DesignerTable = {
      id,
      name: `Table${tables.value.length + 1}`,
      columns: [{ id: crypto.randomUUID(), name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
    }
    tables.value = [...tables.value, table]
    positions.value = {
      ...positions.value,
      [id]: position ?? { x: 100 + tables.value.length * 40, y: 100 + tables.value.length * 40 }
    }
  }

  function updateTableName(tableId: string, name: string): void {
    tables.value = tables.value.map((t) => (t.id === tableId ? { ...t, name } : t))
  }

  function removeTable(tableId: string): void {
    tables.value = tables.value.filter((t) => t.id !== tableId)
    relationships.value = relationships.value.filter(
      (r) => r.fromTableId !== tableId && r.toTableId !== tableId
    )
    const next = { ...positions.value }
    delete next[tableId]
    positions.value = next
  }

  // ─── Column CRUD ─────────────────────────────────────────────────────────

  function addColumn(tableId: string, columnData: Omit<DesignerColumn, 'id'>): void {
    const newCol: DesignerColumn = { id: crypto.randomUUID(), ...columnData }
    tables.value = tables.value.map((t) =>
      t.id === tableId ? { ...t, columns: [...t.columns, newCol] } : t
    )
  }

  function updateColumn(tableId: string, columnId: string, patch: Partial<DesignerColumn>): void {
    tables.value = tables.value.map((t) =>
      t.id === tableId
        ? { ...t, columns: t.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)) }
        : t
    )
  }

  function removeColumn(tableId: string, columnId: string): void {
    tables.value = tables.value.map((t) =>
      t.id === tableId ? { ...t, columns: t.columns.filter((c) => c.id !== columnId) } : t
    )
  }

  // ─── Relationship Actions ─────────────────────────────────────────────────

  function addRelationship(connection: Connection): void {
    if (!connection.source || !connection.target) return
    const rel: DesignerRelationship = {
      id: crypto.randomUUID(),
      fromTableId: connection.source,
      fromColumnId: connection.sourceHandle ?? '',
      toTableId: connection.target,
      toColumnId: connection.targetHandle ?? '',
      type: '1:N'
    }
    relationships.value = [...relationships.value, rel]
  }

  function updateRelationshipType(relId: string, type: '1:1' | '1:N' | 'N:M'): void {
    relationships.value = relationships.value.map((r) => (r.id === relId ? { ...r, type } : r))
  }

  function removeRelationship(relId: string): void {
    relationships.value = relationships.value.filter((r) => r.id !== relId)
  }

  // ─── Selection ───────────────────────────────────────────────────────────

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  function selectEdge(edgeId: string | null): void {
    selectedEdgeId.value = edgeId
  }

  function clearSelection(): void {
    selectedNodeId.value = null
    selectedEdgeId.value = null
  }

  // ─── Canvas Actions ───────────────────────────────────────────────────────

  function clearCanvas(): void {
    tables.value = []
    relationships.value = []
    positions.value = {}
    generating.value = false
    generateError.value = null
    selectedNodeId.value = null
    selectedEdgeId.value = null
  }

  function updatePosition(nodeId: string, pos: { x: number; y: number }): void {
    positions.value = { ...positions.value, [nodeId]: pos }
  }

  // ─── DDL Actions ──────────────────────────────────────────────────────────

  function plainSchema(): DesignerSchema {
    // JSON.parse(JSON.stringify(...)) strips Vue reactive Proxy wrappers so
    // Electron's contextBridge structured-clone serializer can handle the object.
    return JSON.parse(JSON.stringify({ tables: tables.value, relationships: relationships.value })) as DesignerSchema
  }

  async function copyDDL(): Promise<void> {
    const result = await window.designerApi.generateDDL(plainSchema())
    if (result.success && result.ddl !== undefined) {
      await navigator.clipboard.writeText(result.ddl)
    }
  }

  async function exportDDL(): Promise<void> {
    const result = await window.designerApi.generateDDL(plainSchema())
    if (!result.success || result.ddl === undefined) return

    const filePath = await window.exportApi.showSaveDialog(
      JSON.stringify({ defaultPath: 'schema.sql', filters: [{ name: 'SQL', extensions: ['sql'] }] })
    )
    if (!filePath) return

    if (typeof window.designerApi.writeDDL === 'function') {
      await window.designerApi.writeDDL(filePath, result.ddl)
    }
  }

  // ─── Computed ─────────────────────────────────────────────────────────────

  const nodes = computed((): Node[] =>
    tables.value.map((table) => ({
      id: table.id,
      type: 'designer-table',
      position: positions.value[table.id] ?? { x: 0, y: 0 },
      data: { table }
    }))
  )

  const edges = computed((): Edge[] =>
    relationships.value.map((rel) => {
      const fromTable = tables.value.find((t) => t.id === rel.fromTableId)
      const toTable = tables.value.find((t) => t.id === rel.toTableId)
      if (!fromTable || !toTable) return null
      return {
        id: rel.id,
        source: rel.fromTableId,
        target: rel.toTableId,
        type: 'designer-relationship',
        data: { type: rel.type, relId: rel.id }
      }
    }).filter((e): e is Edge => e !== null)
  )

  return {
    tables,
    relationships,
    positions,
    generating,
    generateError,
    selectedNodeId,
    selectedEdgeId,

    nodes,
    edges,

    generateFromPrompt,
    addTable,
    updateTableName,
    removeTable,
    addColumn,
    updateColumn,
    removeColumn,
    addRelationship,
    updateRelationshipType,
    removeRelationship,
    selectNode,
    selectEdge,
    clearSelection,
    clearCanvas,
    updatePosition,
    copyDDL,
    exportDDL
  }
})
