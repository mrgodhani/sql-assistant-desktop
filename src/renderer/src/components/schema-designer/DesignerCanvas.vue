<script setup lang="ts">
import { computed, markRaw, ref, watch, provide } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import type { NodeMouseEvent } from '@vue-flow/core'
import dagre from 'dagre'
import TableNode from '@renderer/components/schema/TableNode.vue'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import type { SchemaDesign, TableDesign, ColumnDesign } from '../../../../shared/types'
import type { TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo } from '../../../../shared/types'
import type {
  SchemaNode,
  SchemaEdge,
  TableNodeData
} from '@renderer/stores/useSchemaVisualizationStore'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'

const props = defineProps<{
  schema: SchemaDesign | null
  previousSchema: SchemaDesign | null
  filteredTables: string[] | null
}>()

const nodeTypes = {
  table: markRaw(TableNode)
} as Record<string, unknown>

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: false
}

const selectedNodeId = ref<string | null>(null)
const expandedNodes = ref(new Set<string>())
const { fitView, setNodes, setEdges } = useVueFlow()
const schemaDesignerStore = useSchemaDesignerStore()

function toggleColumns(nodeId: string): void {
  const next = new Set(expandedNodes.value)
  if (next.has(nodeId)) {
    next.delete(nodeId)
  } else {
    next.add(nodeId)
  }
  expandedNodes.value = next
}

provide('toggleColumns', toggleColumns)

function tableDesignToTableInfo(td: TableDesign): TableInfo {
  const pk = td.primaryKey ?? []
  const cols = td.columns ?? []

  const columns: ColumnInfo[] = cols.map((col: ColumnDesign) => ({
    name: col.name,
    type: col.type,
    nullable: col.nullable,
    defaultValue: col.default,
    isPrimaryKey: pk.includes(col.name),
    isAutoIncrement: false
  }))

  const foreignKeys: ForeignKeyInfo[] = cols
    .filter((col: ColumnDesign) => col.foreignKey)
    .map((col: ColumnDesign) => ({
      columns: [col.name],
      referencedTable: col.foreignKey!.table,
      referencedColumns: [col.foreignKey!.column]
    }))

  const indexes: IndexInfo[] = (td.indexes ?? []).map((idx) => ({
    name: idx.name,
    columns: idx.columns,
    isUnique: idx.unique
  }))

  return {
    name: td.name,
    schema: td.schema,
    type: 'table' as const,
    columns,
    primaryKey: pk,
    foreignKeys,
    indexes
  }
}

const NODE_WIDTH = 280
const COLUMN_ROW_HEIGHT = 28
const NODE_HEADER_HEIGHT = 40
const NODE_PADDING = 16

function buildNodeId(td: TableDesign): string {
  return td.schema ? `${td.schema}.${td.name}` : td.name
}

/**
 * Resolves a FK target table name to the full node ID.
 * Handles the case where FK references use plain names (e.g. "Customers")
 * but node IDs include schema prefixes (e.g. "dbo.Customers").
 */
function resolveTargetNodeId(
  fkTable: string,
  tableIdSet: Set<string>,
  tableNameToId: Map<string, string>
): string | null {
  if (tableIdSet.has(fkTable)) return fkTable
  return tableNameToId.get(fkTable) ?? null
}

const visibleTables = computed((): TableDesign[] => {
  if (!props.schema) return []
  if (!props.filteredTables || props.filteredTables.length === 0) return props.schema.tables

  const filterSet = new Set(props.filteredTables.map((n) => n.toLowerCase()))
  return props.schema.tables.filter(
    (td) =>
      filterSet.has(td.name.toLowerCase()) || filterSet.has(`${td.schema}.${td.name}`.toLowerCase())
  )
})

const previousTableNames = computed(() => {
  if (!props.previousSchema) return new Set<string>()
  return new Set(props.previousSchema.tables.map((t) => t.name))
})

const nodes = computed((): SchemaNode[] => {
  if (!props.schema) return []

  return visibleTables.value.map((td: TableDesign) => {
    const id = buildNodeId(td)
    const tableInfo = tableDesignToTableInfo(td)
    const isNew = !previousTableNames.value.has(td.name)

    return {
      id,
      type: 'table',
      position: { x: 0, y: 0 },
      data: {
        table: tableInfo,
        isSelected: selectedNodeId.value === id,
        isConnected: false,
        isDimmed: false,
        isExpanded: expandedNodes.value.has(id)
      } as TableNodeData,
      class: isNew ? 'ring-2 ring-green-500/60' : undefined
    } as SchemaNode
  })
})

const edges = computed((): SchemaEdge[] => {
  if (!props.schema) return []

  const tables = visibleTables.value
  const allEdges: SchemaEdge[] = []
  const tableIdSet = new Set(tables.map(buildNodeId))
  const tableNameToId = new Map(tables.map((td) => [td.name, buildNodeId(td)]))

  for (const table of tables) {
    const sourceId = buildNodeId(table)
    const cols = table.columns ?? []
    for (const col of cols) {
      if (!col.foreignKey) continue
      const targetId = resolveTargetNodeId(col.foreignKey.table, tableIdSet, tableNameToId)
      if (!targetId) continue

      allEdges.push({
        id: `${sourceId}.${col.name}->${targetId}.${col.foreignKey.column}`,
        source: sourceId,
        target: targetId,
        sourceHandle: `source-${col.name}`,
        targetHandle: `target-${col.foreignKey.column}`,
        type: 'smoothstep',
        animated: false,
        label: '1 : N',
        labelBgPadding: [4, 3] as [number, number],
        labelBgBorderRadius: 4
      })
    }
  }

  return allEdges
})

function resolveColor(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
}

const styledEdges = computed(() => {
  const selected = selectedNodeId.value
  const mutedColor = `hsl(${resolveColor('--muted-foreground')})`
  const primaryColor = `hsl(${resolveColor('--primary')})`
  const fgColor = `hsl(${resolveColor('--foreground')})`
  const bgColor = `hsl(${resolveColor('--background')})`

  return edges.value.map((edge) => {
    const isHighlighted = selected ? edge.source === selected || edge.target === selected : false

    return {
      ...edge,
      style: {
        stroke: isHighlighted ? primaryColor : mutedColor,
        strokeWidth: isHighlighted ? 2.5 : 1.5,
        opacity: selected ? (isHighlighted ? 1 : 0.25) : 0.6
      },
      labelStyle: {
        fontSize: '10px',
        fontWeight: 600,
        fill: isHighlighted ? primaryColor : fgColor,
        opacity: selected ? (isHighlighted ? 1 : 0.25) : 0.8
      },
      labelBgStyle: {
        fill: bgColor,
        fillOpacity: 0.85
      }
    }
  })
})

const layoutNodes = computed(() => {
  const nodeList = nodes.value
  const edgeList = edges.value
  const stored = schemaDesignerStore.nodePositions
  if (nodeList.length === 0) return []

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  for (const node of nodeList) {
    const colCount = node.data.table.columns.length
    const height = NODE_HEADER_HEIGHT + colCount * COLUMN_ROW_HEIGHT + NODE_PADDING
    g.setNode(node.id, { width: NODE_WIDTH, height })
  }
  for (const edge of edgeList) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodeList.map((node) => {
    const dagrePos = g.node(node.id)
    const dagrePosition = {
      x: dagrePos.x - NODE_WIDTH / 2,
      y: dagrePos.y - (dagrePos.height as number) / 2
    }
    const position = stored[node.id] ?? dagrePosition
    return {
      ...node,
      position
    } as SchemaNode
  })
})

watch(
  layoutNodes,
  (newNodes) => {
    setNodes(newNodes)
    const stored = schemaDesignerStore.nodePositions
    for (const n of newNodes) {
      if (!(n.id in stored)) {
        schemaDesignerStore.setNodePosition(n.id, n.position)
      }
    }
    if (newNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2 }), 50)
    }
  },
  { deep: true }
)

watch(
  styledEdges,
  (newEdges) => {
    setEdges(newEdges as SchemaEdge[])
  },
  { deep: true }
)

function onNodeClick(event: NodeMouseEvent): void {
  selectedNodeId.value = event.node.id === selectedNodeId.value ? null : event.node.id
}

function onPaneClick(): void {
  selectedNodeId.value = null
}
</script>

<template>
  <div class="h-full w-full relative">
    <VueFlow
      v-if="schema"
      :node-types="nodeTypes as any"
      :default-edge-options="defaultEdgeOptions"
      :fit-view-on-init="true"
      class="h-full w-full"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <MiniMap class="bg-muted/50! border-border!" />
      <Controls class="bg-background! border-border! shadow-sm!" />
    </VueFlow>
    <div v-else class="flex h-full w-full items-center justify-center text-muted-foreground">
      <div class="text-center space-y-2">
        <p class="text-lg font-medium">No schema yet</p>
        <p class="text-sm">Describe your database in the chat to get started.</p>
      </div>
    </div>
  </div>
</template>
