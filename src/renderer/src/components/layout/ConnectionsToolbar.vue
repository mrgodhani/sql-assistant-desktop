<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useConnectionsViewStore } from '@renderer/stores/useConnectionsViewStore'

const connectionsViewStore = useConnectionsViewStore()

function onNewConnection(): void {
  if (connectionsViewStore.mode !== 'list') return
  connectionsViewStore.setCreateMode()
}

function onCancel(): void {
  connectionsViewStore.setListMode()
}
</script>

<template>
  <div class="flex flex-1 items-center justify-between gap-2">
    <h1 class="text-sm font-semibold">Database Connections</h1>
    <Button
      v-if="connectionsViewStore.mode === 'list'"
      size="sm"
      data-testid="connections-new-button"
      @click="onNewConnection"
    >
      <Plus class="mr-2 size-4" />
      New Connection
    </Button>
    <Button
      v-else
      variant="ghost"
      size="sm"
      data-testid="connections-cancel-button"
      @click="onCancel"
    >
      Cancel
    </Button>
  </div>
</template>
