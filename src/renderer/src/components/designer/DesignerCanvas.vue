<script setup lang="ts">
import { markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import type { NodeDragEvent, Connection } from '@vue-flow/core'
import { useDesignerStore } from '@renderer/stores/useDesignerStore'
import DesignerTableNode from './DesignerTableNode.vue'
import DesignerRelationshipEdge from './DesignerRelationshipEdge.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

const store = useDesignerStore()
const { fitView } = useVueFlow()

defineExpose({ fitView })

const nodeTypes = {
  'designer-table': markRaw(DesignerTableNode)
} as Record<string, unknown>

const edgeTypes = {
  'designer-relationship': markRaw(DesignerRelationshipEdge)
} as Record<string, unknown>

function onNodeDragStop(event: NodeDragEvent): void {
  store.updatePosition(event.node.id, event.node.position)
}

function onConnect(connection: Connection): void {
  store.addRelationship(connection)
}

function onEdgeClick(event: { edge: { id: string } }): void {
  store.selectEdge(event.edge.id)
}

function onPaneClick(): void {
  store.clearSelection()
}
</script>

<template>
  <VueFlow
    :nodes="store.nodes"
    :edges="store.edges"
    :node-types="nodeTypes as any"
    :edge-types="edgeTypes as any"
    :fit-view-on-init="true"
    :connect-on-click="false"
    connection-mode="loose"
    class="h-full w-full"
    @node-drag-stop="onNodeDragStop"
    @connect="onConnect"
    @edge-click="onEdgeClick"
    @pane-click="onPaneClick"
  >
    <Controls position="bottom-right" />
  </VueFlow>
</template>
