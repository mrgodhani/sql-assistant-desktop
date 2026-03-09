<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import ConnectionForm from '@renderer/components/connections/ConnectionForm.vue'
import ConnectionList from '@renderer/components/connections/ConnectionList.vue'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'

const store = useConnectionStore()

const mode = ref<'list' | 'create' | 'edit'>('list')
const editingConnectionId = ref<string | null>(null)

onMounted(async () => {
  if (!store.connections.length) {
    await store.loadConnections()
  }
})

function onEdit(connectionId: string): void {
  editingConnectionId.value = connectionId
  mode.value = 'edit'
}

function onSaved(): void {
  mode.value = 'list'
  editingConnectionId.value = null
}

function cancelForm(): void {
  mode.value = 'list'
  editingConnectionId.value = null
}
</script>

<template>
  <div class="h-full overflow-y-auto" data-testid="connections-view">
    <div class="mx-auto max-w-3xl p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight">Database Connections</h1>
        <Button
          v-if="mode === 'list'"
          data-testid="connections-new-button"
          @click="mode = 'create'"
        >
          <Plus class="mr-2 size-4" />
          New Connection
        </Button>
        <Button
          v-else
          variant="ghost"
          data-testid="connections-cancel-button"
          @click="cancelForm"
        >
          Cancel
        </Button>
      </div>

      <ConnectionForm
        v-if="mode !== 'list'"
        :connection-id="editingConnectionId ?? undefined"
        @saved="onSaved"
        @cancel="cancelForm"
      />
      <ConnectionList
        v-else
        @edit="onEdit"
      />
    </div>
  </div>
</template>
