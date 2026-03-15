<script setup lang="ts">
import { useSchemaDesignerStore } from '@renderer/stores/useSchemaDesignerStore'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import SessionStartDialog from '@renderer/components/schema-designer/SessionStartDialog.vue'
import DesignerToolbar from '@renderer/components/schema-designer/DesignerToolbar.vue'
import DesignerChat from '@renderer/components/schema-designer/DesignerChat.vue'
import DesignerCanvas from '@renderer/components/schema-designer/DesignerCanvas.vue'
import type { DatabaseType } from '../../../shared/types'

const store = useSchemaDesignerStore()
const connectionStore = useConnectionStore()

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
</script>

<template>
  <div class="flex h-full flex-col">
    <template v-if="store.hasSession">
      <DesignerToolbar />
      <div class="flex flex-1 overflow-hidden">
        <div class="w-[400px] min-w-[320px] max-w-[500px] border-r border-border flex flex-col">
          <DesignerChat />
        </div>
        <div class="flex-1">
          <DesignerCanvas
            :schema="store.schema"
            :previous-schema="store.previousSchema"
            :filtered-tables="store.filteredTables"
          />
        </div>
      </div>
    </template>
    <SessionStartDialog v-else @start="onStart" />
  </div>
</template>
