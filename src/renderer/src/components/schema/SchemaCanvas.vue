<script setup lang="ts">
import { computed, watch, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { NodeMouseEvent } from '@vue-flow/core'
import { useSchemaVisualizationStore } from '@renderer/stores/useSchemaVisualizationStore'
import TableNode from './TableNode.vue'
import SchemaControls from './SchemaControls.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const store = useSchemaVisualizationStore()

const nodeTypes = { table: markRaw(TableNode) } as Record<string, unknown>

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: false
}

const { fitView } = useVueFlow()

const styledEdges = computed(() => {
  const selected = store.selectedNodeId
  if (!selected) return store.edges

  return store.edges.map((edge) => {
    const isHighlighted = edge.source === selected || edge.target === selected
    return {
      ...edge,
      style: {
        stroke: isHighlighted ? 'hsl(var(--primary))' : undefined,
        strokeWidth: isHighlighted ? 2 : 1,
        opacity: isHighlighted ? 1 : 0.3
      }
    }
  })
})

function onNodeClick(event: NodeMouseEvent): void {
  store.selectNode(event.node.id)
}

function onPaneClick(): void {
  store.selectNode(null)
}

watch(
  () => store.nodes.length,
  (len) => {
    if (len > 0) {
      setTimeout(() => fitView({ padding: 0.2 }), 50)
    }
  }
)
</script>

<template>
  <VueFlow
    v-model:nodes="store.nodes"
    :edges="(styledEdges as any)"
    :node-types="(nodeTypes as any)"
    :default-edge-options="defaultEdgeOptions"
    :fit-view-on-init="true"
    class="h-full w-full"
    @node-click="onNodeClick"
    @pane-click="onPaneClick"
  >
    <SchemaControls />
  </VueFlow>
</template>
