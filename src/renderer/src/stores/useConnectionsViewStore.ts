import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ConnectionsViewMode = 'list' | 'create' | 'edit'

export const useConnectionsViewStore = defineStore('connectionsView', () => {
  const mode = ref<ConnectionsViewMode>('list')
  const editingConnectionId = ref<string | null>(null)

  function setListMode(): void {
    mode.value = 'list'
    editingConnectionId.value = null
  }

  function setCreateMode(): void {
    mode.value = 'create'
    editingConnectionId.value = null
  }

  function setEditMode(connectionId: string): void {
    mode.value = 'edit'
    editingConnectionId.value = connectionId
  }

  return { mode, editingConnectionId, setListMode, setCreateMode, setEditMode }
})
