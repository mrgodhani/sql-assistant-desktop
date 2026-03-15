<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Network } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import LoadingSpinner from '@renderer/components/shared/LoadingSpinner.vue'
import ErrorMessage from '@renderer/components/shared/ErrorMessage.vue'
import EmptyState from '@renderer/components/shared/EmptyState.vue'
import SchemaToolbar from '@renderer/components/schema/SchemaToolbar.vue'
import SchemaCanvas from '@renderer/components/schema/SchemaCanvas.vue'
import { useSchemaVisualizationStore } from '@renderer/stores/useSchemaVisualizationStore'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'

const route = useRoute()
const store = useSchemaVisualizationStore()
const connectionStore = useConnectionStore()

const selectedConnectionId = ref<string | null>(null)

onMounted(async () => {
  if (!connectionStore.connections.length) {
    await connectionStore.loadConnections()
  }

  const paramId = route.params.connectionId as string | undefined
  if (paramId) {
    selectedConnectionId.value = paramId
  } else if (connectionStore.connectedConnections.length) {
    selectedConnectionId.value = connectionStore.connectedConnections[0].id
  }

  if (selectedConnectionId.value) {
    await store.loadSchema(selectedConnectionId.value)
  }
})

watch(
  () => route.params.connectionId,
  async (newId) => {
    if (newId && typeof newId === 'string') {
      selectedConnectionId.value = newId
      await store.loadSchema(newId)
    }
  }
)

async function onConnectionChange(connId: string): Promise<void> {
  selectedConnectionId.value = connId
  const status = connectionStore.getStatus(connId)
  if (status.status !== 'connected') {
    await connectionStore.connect(connId)
  }
  await store.loadSchema(connId)
}

function retryLoad(): void {
  if (selectedConnectionId.value) {
    store.loadSchema(selectedConnectionId.value)
  }
}
</script>

<template>
  <div class="flex h-full flex-col" data-testid="schema-view">
    <!-- No connections -->
    <div v-if="!connectionStore.connections.length" class="flex flex-1 items-center justify-center">
      <EmptyState
        :icon="Network"
        title="No connections"
        message="Add a database connection to visualize its schema."
      >
        <template #default>
          <router-link to="/connections">
            <Button variant="outline" size="sm" class="mt-3">
              Add Connection
            </Button>
          </router-link>
        </template>
      </EmptyState>
    </div>

    <!-- Has connections -->
    <template v-else>
      <!-- Connection picker (when no route param) -->
      <div
        v-if="!route.params.connectionId"
        class="flex items-center gap-3 px-4 py-2 border-b border-border bg-background"
      >
        <span class="text-sm text-muted-foreground">Connection:</span>
        <Select
          :model-value="selectedConnectionId ?? undefined"
          @update:model-value="onConnectionChange"
        >
          <SelectTrigger class="w-[240px]" size="sm">
            <SelectValue placeholder="Select a connection..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="conn in connectionStore.connections"
              :key="conn.id"
              :value="conn.id"
            >
              {{ conn.name }}
              <span
                v-if="connectionStore.getStatus(conn.id).status === 'connected'"
                class="ml-1 text-xs text-emerald-500"
              >
                connected
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Loading -->
      <div v-if="store.loading" class="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Error -->
      <div v-else-if="store.error" class="flex flex-1 items-center justify-center">
        <ErrorMessage
          title="Schema introspection failed"
          :message="store.error"
          :retry="retryLoad"
        />
      </div>

      <!-- No connection selected -->
      <div v-else-if="!selectedConnectionId" class="flex flex-1 items-center justify-center">
        <EmptyState
          :icon="Network"
          title="Select a connection"
          message="Choose a database connection above to visualize its schema."
        />
      </div>

      <!-- No tables -->
      <div v-else-if="store.tableCount === 0 && !store.loading" class="flex flex-1 items-center justify-center">
        <EmptyState
          :icon="Network"
          title="No tables found"
          message="This database has no tables or views."
        />
      </div>

      <!-- Schema loaded -->
      <template v-else>
        <SchemaToolbar />
        <div class="flex-1 min-h-0">
          <SchemaCanvas />
        </div>
      </template>
    </template>
  </div>
</template>
