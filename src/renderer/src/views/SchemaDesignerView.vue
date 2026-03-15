<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import SessionStartDialog from '@renderer/components/schema-designer/SessionStartDialog.vue'
import DesignerToolbar from '@renderer/components/schema-designer/DesignerToolbar.vue'
import DesignerChat from '@renderer/components/schema-designer/DesignerChat.vue'
import DesignerCanvas from '@renderer/components/schema-designer/DesignerCanvas.vue'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '@renderer/components/ui/resizable'
import type { DatabaseType } from '../../../shared/types'

const store = useSchemaDesignerStore()
const connectionStore = useConnectionStore()

const layoutMode = ref<'TB' | 'LR' | 'clustered'>('TB')

async function onStart(config: {
  mode: 'scratch' | 'existing'
  dialect?: DatabaseType
  connectionId?: string
}): Promise<void> {
  if (config.mode === 'scratch') {
    await store.startSession(config.dialect ?? 'postgresql')
  } else if (config.connectionId) {
    const conn = connectionStore.connections.find((c) => c.id === config.connectionId)
    if (conn) {
      await store.startSession(conn.type, conn.id)
    }
  }
}

function onRelayout(mode: 'TB' | 'LR' | 'clustered'): void {
  layoutMode.value = mode
  store.clearNodePositions()
}

onUnmounted(() => {
  store.cancel()
})
</script>

<template>
  <div class="flex h-full flex-col">
    <template v-if="store.hasSession">
      <DesignerToolbar @relayout="onRelayout" />
      <ResizablePanelGroup direction="horizontal" class="flex-1 overflow-hidden">
        <ResizablePanel :default-size="30" :min-size="20" :max-size="50" class="flex flex-col">
          <DesignerChat />
        </ResizablePanel>
        <ResizableHandle with-handle />
        <ResizablePanel :default-size="70" :min-size="40" class="flex flex-col">
          <DesignerCanvas
            :schema="store.schema"
            :previous-schema="store.previousSchema"
            :filtered-tables="store.filteredTables"
            :layout-mode="layoutMode"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </template>
    <SessionStartDialog v-else @start="onStart" />
  </div>
</template>
