<script setup lang="ts">
import { computed } from 'vue'
import type { DatabaseConnection, ConnectionStatus } from '../../../../shared/types'
import { DATABASE_TYPE_LABELS } from '../../../../shared/types'

const props = defineProps<{
  connection: DatabaseConnection
  status: ConnectionStatus
}>()

const statusDotClass = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-muted-foreground/40'
  }
})

const typeLabel = computed(() => DATABASE_TYPE_LABELS[props.connection.type])
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/50"
    :title="`${connection.name} (${typeLabel}) — ${status}`"
    data-testid="sidebar-connection-item"
  >
    <span :class="statusDotClass" class="size-2 shrink-0 rounded-full" />
    <span class="truncate">{{ connection.name }}</span>
  </div>
</template>
