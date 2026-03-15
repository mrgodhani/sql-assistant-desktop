<script setup lang="ts">
import { computed, ref, markRaw, onMounted, onUnmounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import type { NodeMouseEvent, NodeDragEvent } from '@vue-flow/core'
import { useSchemaVisualizationStore } from '@renderer/stores/useSchemaVisualizationStore'
import TableNode from './TableNode.vue'
import GroupNode from './GroupNode.vue'
import SchemaControls from './SchemaControls.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const store = useSchemaVisualizationStore()
const controlsRef = ref<InstanceType<typeof SchemaControls> | null>(null)

const nodeTypes = {
  table: markRaw(TableNode),
  group: markRaw(GroupNode)
} as Record<string, unknown>

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: false
}

function resolveColor(cssVar: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim()
}

const styledEdges = computed(() => {
  const selected = store.selectedNodeId
  const visibleEdges = store.visibleEdges
  const mutedColor = `hsl(${resolveColor('--muted-foreground')})`
  const primaryColor = `hsl(${resolveColor('--primary')})`

  return visibleEdges.map((edge) => {
    const isHighlighted = selected
      ? edge.source === selected || edge.target === selected
      : false

    return {
      ...edge,
      style: {
        stroke: isHighlighted ? primaryColor : mutedColor,
        strokeWidth: isHighlighted ? 2.5 : 1.5,
        opacity: selected ? (isHighlighted ? 1 : 0.25) : 0.6
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

function onNodeDragStop(event: NodeDragEvent): void {
  const node = store.nodes.find((n) => n.id === event.node.id)
  if (node) {
    node.position = event.node.position
  }
}

function onKeydown(e: KeyboardEvent): void {
  const meta = e.metaKey || e.ctrlKey

  if (e.key === '/' || (meta && e.key === 'f')) {
    e.preventDefault()
    const searchInput = document.querySelector(
      '[data-testid="schema-search-input"]'
    ) as HTMLInputElement
    searchInput?.focus()
  }

  if (e.key === 'Escape') {
    store.selectNode(null)
    store.setSearch('')
  }

  if (meta && e.key === '0') {
    e.preventDefault()
    controlsRef.value?.fitView({ padding: 0.2 })
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <VueFlow
    :nodes="store.visibleNodes"
    :edges="(styledEdges as any)"
    :node-types="(nodeTypes as any)"
    :default-edge-options="defaultEdgeOptions"
    :fit-view-on-init="true"
    class="h-full w-full"
    @node-click="onNodeClick"
    @pane-click="onPaneClick"
    @node-drag-stop="onNodeDragStop"
  >
    <SchemaControls ref="controlsRef" />
  </VueFlow>
</template>
