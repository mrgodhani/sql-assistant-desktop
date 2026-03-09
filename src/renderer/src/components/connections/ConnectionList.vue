<script setup lang="ts">
import { Database } from 'lucide-vue-next'
import EmptyState from '@renderer/components/shared/EmptyState.vue'
import ConnectionCard from './ConnectionCard.vue'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'

defineEmits<{
  edit: [connectionId: string]
}>()

const store = useConnectionStore()

async function onConnect(id: string): Promise<void> {
  await store.connect(id)
}

async function onDisconnect(id: string): Promise<void> {
  await store.disconnect(id)
}

async function onDelete(id: string): Promise<void> {
  await store.deleteConnection(id)
}
</script>

<template>
  <div class="space-y-3" data-testid="connection-list">
    <EmptyState
      v-if="!store.connections.length"
      :icon="Database"
      title="No connections"
      message="Create your first database connection to get started"
    />
    <ConnectionCard
      v-for="conn in store.connections"
      :key="conn.id"
      :connection="conn"
      :status="store.getStatus(conn.id).status"
      :error="store.getStatus(conn.id).error"
      @edit="$emit('edit', conn.id)"
      @delete="onDelete(conn.id)"
      @connect="onConnect(conn.id)"
      @disconnect="onDisconnect(conn.id)"
    />
  </div>
</template>
