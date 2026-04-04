<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { PenTool } from 'lucide-vue-next'
import DesignerNLPanel from '@renderer/components/designer/DesignerNLPanel.vue'
import DesignerCanvas from '@renderer/components/designer/DesignerCanvas.vue'
import DesignerToolbar from '@renderer/components/designer/DesignerToolbar.vue'
import EmptyState from '@renderer/components/shared/EmptyState.vue'
import { useDesignerStore } from '@renderer/stores/useDesignerStore'

const store = useDesignerStore()
const canvasRef = ref<InstanceType<typeof DesignerCanvas> | null>(null)

function onKeydown(e: KeyboardEvent): void {
  const meta = e.metaKey || e.ctrlKey

  if (meta && e.key === 'Enter') {
    e.preventDefault()
    const textarea = document.querySelector('[data-testid="nl-textarea"]') as HTMLTextAreaElement
    textarea?.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'Enter', bubbles: true }))
  }

  if (meta && e.key === '0') {
    e.preventDefault()
    canvasRef.value?.fitView({ padding: 0.2 })
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === document.body) {
    if (store.selectedEdgeId) {
      store.removeRelationship(store.selectedEdgeId)
      store.selectEdge(null)
    } else if (store.selectedNodeId) {
      store.removeTable(store.selectedNodeId)
      store.selectNode(null)
    }
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex h-full" data-testid="designer-view">
    <!-- NL Panel -->
    <div class="w-[320px] shrink-0 flex flex-col overflow-y-auto">
      <DesignerNLPanel />
    </div>

    <!-- Canvas + toolbar -->
    <div class="relative flex-1 min-w-0">
      <!-- Empty state overlay -->
      <div
        v-if="store.tables.length === 0"
        class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
      >
        <EmptyState
          :icon="PenTool"
          title="Start designing"
          message="Describe your schema in the panel on the left, or click + Add Table to start manually."
        />
      </div>

      <DesignerCanvas ref="canvasRef" class="h-full w-full" />

      <!-- Toolbar (bottom-left) -->
      <div class="absolute bottom-4 left-4 z-10">
        <DesignerToolbar />
      </div>
    </div>
  </div>
</template>
