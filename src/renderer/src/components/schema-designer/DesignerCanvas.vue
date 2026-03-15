<script setup lang="ts">
import { computed, markRaw, ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
import type { NodeMouseEvent } from '@vue-flow/core'
import dagre from 'dagre'
import TableNode from '@renderer/components/schema/TableNode.vue'
import type { SchemaDesign, TableDesign, ColumnDesign } from '../../../../shared/types'
import type { TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo } from '../../../../shared/types'
import type { SchemaNode, SchemaEdge, TableNodeData } from '@renderer/stores/useSchemaVisualizationStore'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const props = defineProps<{
  schema: SchemaDesign | null
  previousSchema: SchemaDesign | null
}>()

const nodeTypes = {
  table: markRaw(TableNode)
} as Record<string, unknown>

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: false
}

const selectedNodeId = ref<string | null>(null)

function tableDesignToTableInfo(td: TableDesign): TableInfo {
  const columns: ColumnInfo[] = td.columns.map((col: ColumnDesign) => ({
    name: col.name,
    type: col.type,
    nullable: col.nullable,
    defaultValue: col.default,
    isPrimaryKey: td.primaryKey.includes(col.name),
    isAutoIncrement: false
  }))

  const foreignKeys: ForeignKeyInfo[] = td.columns
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
    primaryKey: td.primaryKey,
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

const previousTableNames = computed(() => {
  if (!props.previousSchema) return new Set<string>()
  return new Set(props.previousSchema.tables.map((t) => t.name))
})

const nodes = computed((): SchemaNode[] => {
  if (!props.schema) return []

  return props.schema.tables.map((td: TableDesign) => {
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
        isExpanded: false
      } as TableNodeData,
      class: isNew ? 'ring-2 ring-green-500/60' : undefined
    } as SchemaNode
  })
})

const edges = computed((): SchemaEdge[] => {
  if (!props.schema) return []

  const allEdges: SchemaEdge[] = []
  const tableIds = new Set(props.schema.tables.map(buildNodeId))

  for (const table of props.schema.tables) {
    const sourceId = buildNodeId(table)
    for (const col of table.columns) {
      if (!col.foreignKey) continue
      const targetId = col.foreignKey.table
      if (!tableIds.has(targetId)) continue

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

const layoutNodes = computed(() => {
  const nodeList = nodes.value
  const edgeList = edges.value
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
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - (pos.height as number) / 2
      }
    } as SchemaNode
  })
})

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
      :nodes="layoutNodes"
      :edges="(edges as any)"
      :node-types="(nodeTypes as any)"
      :default-edge-options="defaultEdgeOptions"
      :fit-view-on-init="true"
      class="h-full w-full"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center text-muted-foreground"
    >
      <div class="text-center space-y-2">
        <p class="text-lg font-medium">No schema yet</p>
        <p class="text-sm">Describe your database in the chat to get started.</p>
      </div>
    </div>
  </div>
</template>
