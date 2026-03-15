import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dagre from 'dagre'
import { exportDiagram } from '@/lib/export-diagram'
export type RelationshipType = '1:1' | '1:N' | 'N:M'

export interface SchemaEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  animated?: boolean
  style?: Record<string, unknown>
  label?: string
  labelStyle?: Record<string, unknown>
  labelBgStyle?: Record<string, unknown>
  labelBgPadding?: [number, number]
  labelBgBorderRadius?: number
  data?: { relationshipType: RelationshipType; isComposite: boolean }
  [key: string]: unknown
}
import type { DatabaseSchema, TableInfo, ForeignKeyInfo } from '../../../shared/types'

export type SchemaFilter = 'all' | 'tables' | 'views' | 'connected' | 'with-relationships'
export type LayoutDirection = 'TB' | 'LR'

const NODE_WIDTH = 280
const COLLAPSED_MAX_COLUMNS = 8
const COLLAPSED_OTHER_COLUMNS = 3
const COLUMN_ROW_HEIGHT = 28
const NODE_HEADER_HEIGHT = 40
const NODE_PADDING = 16
const DAGRE_NODE_SEP = 60
const DAGRE_RANK_SEP = 80

export interface TableNodeData {
  table: TableInfo
  isSelected: boolean
  isConnected: boolean
  isDimmed: boolean
  isExpanded: boolean
}

export interface SchemaNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: TableNodeData
  parentNode?: string
  [key: string]: unknown
}

function buildNodeId(table: TableInfo): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name
}

function buildFkTargetId(fk: ForeignKeyInfo): string {
  return fk.referencedSchema ? `${fk.referencedSchema}.${fk.referencedTable}` : fk.referencedTable
}

function hasFkUniqueIndex(table: TableInfo, fkColumns: string[]): boolean {
  const fkSet = new Set(fkColumns)
  if (fkSet.size === 1) {
    const col = fkColumns[0]
    if (table.primaryKey.length === 1 && table.primaryKey[0] === col) return true
  }
  const pkSet = new Set(table.primaryKey)
  if (fkSet.size === pkSet.size && fkColumns.every((c) => pkSet.has(c))) return true
  return table.indexes.some(
    (idx) =>
      idx.isUnique &&
      idx.columns.length === fkColumns.length &&
      fkColumns.every((c) => idx.columns.includes(c))
  )
}

function isJunctionTable(table: TableInfo): boolean {
  if (table.foreignKeys.length < 2) return false
  const allFkColumns = new Set(table.foreignKeys.flatMap((fk) => fk.columns))
  return table.primaryKey.length >= 2 && table.primaryKey.every((pk) => allFkColumns.has(pk))
}

function determineCardinality(
  sourceTable: TableInfo,
  fk: ForeignKeyInfo
): { type: RelationshipType; isComposite: boolean } {
  const isComposite = fk.columns.length > 1
  const isJunction = isJunctionTable(sourceTable)

  if (isJunction) {
    return { type: 'N:M', isComposite }
  }

  if (hasFkUniqueIndex(sourceTable, fk.columns)) {
    return { type: '1:1', isComposite }
  }

  return { type: '1:N', isComposite }
}

function formatEdgeLabel(type: RelationshipType, isComposite: boolean): string {
  const label = type === '1:1' ? '1 : 1' : type === '1:N' ? '1 : N' : 'N : M'
  return isComposite ? `${label} ⚷` : label
}

export const useSchemaVisualizationStore = defineStore('schemaVisualization', () => {
  const connectionId = ref<string | null>(null)
  const schema = ref<DatabaseSchema | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const nodes = ref<SchemaNode[]>([])
  const edges = ref<SchemaEdge[]>([])
  const selectedNodeId = ref<string | null>(null)
  const expandedGroups = ref(new Set<string>())
  const expandedColumns = ref(new Set<string>())
  const searchQuery = ref('')
  const filter = ref<SchemaFilter>('all')
  const layoutDirection = ref<LayoutDirection>('TB')

  function getVisibleColumnCount(node: SchemaNode): number {
    const table = node.data.table
    if (expandedColumns.value.has(node.id)) {
      return table.columns.length
    }

    const pkColumns = table.columns.filter((c) => c.isPrimaryKey)
    const fkColumnNames = new Set(table.foreignKeys.flatMap((fk) => fk.columns))
    const fkColumns = table.columns.filter((c) => fkColumnNames.has(c.name) && !c.isPrimaryKey)
    const otherColumns = table.columns.filter((c) => !c.isPrimaryKey && !fkColumnNames.has(c.name))

    const priorityCount = pkColumns.length + fkColumns.length
    const othersToShow = Math.min(COLLAPSED_OTHER_COLUMNS, otherColumns.length)
    return Math.min(COLLAPSED_MAX_COLUMNS, priorityCount + othersToShow)
  }

  function getAllTables(): TableInfo[] {
    if (!schema.value) return []
    return [...schema.value.tables, ...schema.value.views]
  }

  function getConnectedNodeIdSet(nodeId: string): Set<string> {
    const connected = new Set<string>()
    for (const edge of edges.value) {
      if (edge.source === nodeId) connected.add(edge.target)
      if (edge.target === nodeId) connected.add(edge.source)
    }
    return connected
  }

  function tablesWithRelationships(): Set<string> {
    const ids = new Set<string>()
    for (const edge of edges.value) {
      ids.add(edge.source)
      ids.add(edge.target)
    }
    return ids
  }

  function updateNodeData(): void {
    const selected = selectedNodeId.value
    const query = searchQuery.value.toLowerCase()
    const connected = selected ? getConnectedNodeIdSet(selected) : new Set<string>()

    const updated: SchemaNode[] = []
    for (const node of nodes.value) {
      const isSelected = node.id === selected
      const isConnected = selected ? connected.has(node.id) : false
      const isExpanded = expandedColumns.value.has(node.id)

      const matchesSearch = query
        ? node.data.table.name.toLowerCase().includes(query) ||
          node.data.table.columns.some((c) => c.name.toLowerCase().includes(query))
        : true
      const dimmedBySelection = selected ? !isSelected && !isConnected : false
      const dimmedBySearch = query ? !matchesSearch : false
      const isDimmed = dimmedBySelection || dimmedBySearch

      updated.push({
        ...node,
        data: { ...node.data, isSelected, isConnected, isDimmed, isExpanded }
      } as SchemaNode)
    }
    nodes.value = updated
  }

  function buildGraph(): void {
    const allTables = getAllTables()
    const nodeIdSet = new Set(allTables.map(buildNodeId))

    nodes.value = allTables.map((table) => ({
      id: buildNodeId(table),
      type: 'table',
      position: { x: 0, y: 0 },
      data: {
        table,
        isSelected: false,
        isConnected: false,
        isDimmed: false,
        isExpanded: expandedColumns.value.has(buildNodeId(table))
      }
    })) as SchemaNode[]

    const newEdges: SchemaEdge[] = []
    for (const table of allTables) {
      const sourceId = buildNodeId(table)
      for (const fk of table.foreignKeys) {
        const targetId = buildFkTargetId(fk)
        if (!nodeIdSet.has(targetId)) continue

        const cardinality = determineCardinality(table, fk)

        newEdges.push({
          id: `${sourceId}.${fk.columns.join(',')}->${targetId}.${fk.referencedColumns.join(',')}`,
          source: sourceId,
          target: targetId,
          sourceHandle: `source-${fk.columns[0]}`,
          targetHandle: `target-${fk.referencedColumns[0]}`,
          type: 'smoothstep',
          animated: false,
          label: formatEdgeLabel(cardinality.type, cardinality.isComposite),
          labelStyle: {
            fontSize: '10px',
            fontWeight: 600,
            fill: 'hsl(var(--foreground))'
          },
          labelBgStyle: {
            fill: 'hsl(var(--background))',
            fillOpacity: 0.85
          },
          labelBgPadding: [4, 3] as [number, number],
          labelBgBorderRadius: 4,
          data: { relationshipType: cardinality.type, isComposite: cardinality.isComposite }
        })
      }
    }
    edges.value = newEdges

    applyLayout()
  }

  function applyLayout(direction?: LayoutDirection): void {
    if (direction) {
      layoutDirection.value = direction
    }

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({
      rankdir: layoutDirection.value,
      nodesep: DAGRE_NODE_SEP,
      ranksep: DAGRE_RANK_SEP
    })

    for (const node of nodes.value) {
      const columnCount = getVisibleColumnCount(node)
      const height = NODE_HEADER_HEIGHT + columnCount * COLUMN_ROW_HEIGHT + NODE_PADDING
      g.setNode(node.id, { width: NODE_WIDTH, height })
    }
    for (const edge of edges.value) {
      g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    nodes.value = nodes.value.map((node) => {
      const pos = g.node(node.id)
      return {
        ...node,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - (pos.height as number) / 2
        }
      } as SchemaNode
    })
  }

  async function loadSchema(connId: string): Promise<void> {
    loading.value = true
    error.value = null
    connectionId.value = connId

    try {
      const result = await window.schemaApi.introspect(connId)
      if (result.success && result.schema) {
        schema.value = result.schema
        buildGraph()
      } else {
        error.value = result.error ?? 'Failed to introspect schema'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load schema'
    } finally {
      loading.value = false
    }
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
    updateNodeData()
  }

  function setSearch(query: string): void {
    searchQuery.value = query
    updateNodeData()
  }

  function setFilter(newFilter: SchemaFilter): void {
    filter.value = newFilter
  }

  function toggleColumns(nodeId: string): void {
    if (expandedColumns.value.has(nodeId)) {
      expandedColumns.value.delete(nodeId)
    } else {
      expandedColumns.value.add(nodeId)
    }
    expandedColumns.value = new Set(expandedColumns.value)
    updateNodeData()
    applyLayout()
  }

  function toggleGroup(groupId: string): void {
    if (expandedGroups.value.has(groupId)) {
      expandedGroups.value.delete(groupId)
    } else {
      expandedGroups.value.add(groupId)
    }
    expandedGroups.value = new Set(expandedGroups.value)
  }

  async function exportImage(format: 'png' | 'svg'): Promise<void> {
    await exportDiagram(format, 'schema')
  }

  const connectedNodeIds = computed((): Set<string> => {
    if (!selectedNodeId.value) return new Set()
    return getConnectedNodeIdSet(selectedNodeId.value)
  })

  const visibleNodes = computed((): SchemaNode[] => {
    let filtered = nodes.value

    switch (filter.value) {
      case 'tables':
        filtered = filtered.filter((n) => n.data.table.type === 'table')
        break
      case 'views':
        filtered = filtered.filter((n) => n.data.table.type === 'view')
        break
      case 'connected':
        if (selectedNodeId.value) {
          const connected = connectedNodeIds.value
          filtered = filtered.filter((n) => n.id === selectedNodeId.value || connected.has(n.id))
        }
        break
      case 'with-relationships': {
        const withRels = tablesWithRelationships()
        filtered = filtered.filter((n) => withRels.has(n.id))
        break
      }
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(
        (n) =>
          n.data.table.name.toLowerCase().includes(query) ||
          n.data.table.columns.some((c) => c.name.toLowerCase().includes(query))
      )
    }

    return filtered
  })

  const visibleEdges = computed(() => {
    const visibleIds = new Set(visibleNodes.value.map((n) => n.id))
    return edges.value.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
  })

  const groups = computed((): Map<string, TableInfo[]> => {
    const allTables = getAllTables()
    const grouped = new Map<string, TableInfo[]>()
    for (const table of allTables) {
      const key = table.schema ?? 'default'
      const existing = grouped.get(key)
      if (existing) {
        existing.push(table)
      } else {
        grouped.set(key, [table])
      }
    }
    return grouped
  })

  const tableCount = computed((): number => {
    if (!schema.value) return 0
    return schema.value.tables.length + schema.value.views.length
  })

  const visibleTableCount = computed((): number => {
    return visibleNodes.value.length
  })

  return {
    connectionId,
    schema,
    loading,
    error,
    nodes,
    edges,
    selectedNodeId,
    expandedGroups,
    expandedColumns,
    searchQuery,
    filter,
    layoutDirection,

    visibleNodes,
    visibleEdges,
    connectedNodeIds,
    groups,
    tableCount,
    visibleTableCount,

    loadSchema,
    buildGraph,
    applyLayout,
    selectNode,
    setSearch,
    setFilter,
    toggleColumns,
    toggleGroup,
    exportImage,
    getVisibleColumnCount
  }
})
