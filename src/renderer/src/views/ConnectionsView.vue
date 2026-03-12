<script setup lang="ts">
import { onMounted } from 'vue'
import ConnectionForm from '@renderer/components/connections/ConnectionForm.vue'
import ConnectionList from '@renderer/components/connections/ConnectionList.vue'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import { useConnectionsViewStore } from '@renderer/stores/useConnectionsViewStore'

const connectionStore = useConnectionStore()
const connectionsViewStore = useConnectionsViewStore()

onMounted(async () => {
  if (!connectionStore.connections.length) {
    await connectionStore.loadConnections()
  }
})

function onEdit(connectionId: string): void {
  connectionsViewStore.setEditMode(connectionId)
}

function onSaved(): void {
  connectionsViewStore.setListMode()
}

function cancelForm(): void {
  connectionsViewStore.setListMode()
}
</script>

<template>
  <div class="h-full overflow-y-auto" data-testid="connections-view">
    <div class="mx-auto max-w-3xl p-6">
      <ConnectionForm
        v-if="connectionsViewStore.mode !== 'list'"
        :connection-id="connectionsViewStore.editingConnectionId ?? undefined"
        @saved="onSaved"
        @cancel="cancelForm"
      />
      <ConnectionList v-else @edit="onEdit" />
    </div>
  </div>
</template>
