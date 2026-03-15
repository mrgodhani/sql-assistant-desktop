<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Database, Plus, MoreHorizontal, Plug, Unplug, Pencil, Trash2 } from 'lucide-vue-next'
import ConnectionForm from '@renderer/components/connections/ConnectionForm.vue'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import { useChatStore } from '@renderer/stores/useChatStore'
import type { ConnectionStatus, DatabaseConnection } from '../../../../shared/types'

const connectionStore = useConnectionStore()
const chatStore = useChatStore()

const popoverOpen = ref(false)
const formDialogOpen = ref(false)
const editingConnectionId = ref<string | undefined>(undefined)
const deleteDialogOpen = ref(false)
const deletingConnectionId = ref<string | null>(null)

onMounted(() => {
  if (connectionStore.connections.length === 0) {
    connectionStore.loadConnections()
  }
})

const activeConnection = computed<DatabaseConnection | null>(() => {
  if (!chatStore.activeConnectionId) return null
  return connectionStore.getConnection(chatStore.activeConnectionId) ?? null
})

const activeStatus = computed<ConnectionStatus>(() => {
  if (!chatStore.activeConnectionId) return 'disconnected'
  return connectionStore.getStatus(chatStore.activeConnectionId).status
})

function statusDotClass(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-muted-foreground/40'
  }
}

function connectionSummary(conn: DatabaseConnection): string {
  if (conn.type === 'sqlite') {
    return conn.filePath || conn.database
  }
  return `${conn.host}:${conn.port}`
}

function selectConnection(id: string): void {
  chatStore.setActiveConnection(id)
}

function connect(id: string): void {
  connectionStore.connect(id)
}

function disconnect(id: string): void {
  connectionStore.disconnect(id)
}

function openAddForm(): void {
  editingConnectionId.value = undefined
  formDialogOpen.value = true
}

function openEditForm(id: string): void {
  editingConnectionId.value = id
  formDialogOpen.value = true
}

function onFormSaved(): void {
  formDialogOpen.value = false
  editingConnectionId.value = undefined
}

function confirmDelete(id: string): void {
  deletingConnectionId.value = id
  deleteDialogOpen.value = true
}

async function executeDelete(): Promise<void> {
  if (!deletingConnectionId.value) return
  const id = deletingConnectionId.value
  await connectionStore.deleteConnection(id)
  if (chatStore.activeConnectionId === id) {
    chatStore.setActiveConnection(null)
  }
  deletingConnectionId.value = null
  deleteDialogOpen.value = false
}
</script>

<template>
  <Popover v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2 text-sm font-normal">
        <span :class="['size-2 rounded-full', statusDotClass(activeStatus)]" />
        <span v-if="activeConnection" class="max-w-[140px] truncate">
          {{ activeConnection.name }}
        </span>
        <span v-else class="text-muted-foreground">No connection</span>
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-[320px] p-0" align="end">
      <div class="flex items-center justify-between border-b px-3 py-2">
        <span class="text-sm font-medium">Connections</span>
        <Button variant="ghost" size="sm" class="h-7 gap-1" @click="openAddForm">
          <Plus class="size-4" />
          Add
        </Button>
      </div>

      <ScrollArea class="max-h-[300px]">
        <div v-if="connectionStore.connections.length === 0" class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Database class="size-8" />
          <span class="text-sm">No connections yet</span>
        </div>

        <div v-else class="p-1">
          <button
            v-for="conn in connectionStore.connections"
            :key="conn.id"
            class="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
            :class="{ 'bg-accent/30': chatStore.activeConnectionId === conn.id }"
            @click="selectConnection(conn.id)"
          >
            <span
              :class="[
                'size-2 shrink-0 rounded-full',
                statusDotClass(connectionStore.getStatus(conn.id).status)
              ]"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">{{ conn.name }}</div>
              <div class="truncate text-xs text-muted-foreground">
                {{ connectionSummary(conn) }}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger as-child @click.stop>
                <Button
                  variant="ghost"
                  size="sm"
                  class="size-7 p-0 opacity-0 group-hover:opacity-100"
                >
                  <MoreHorizontal class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  v-if="connectionStore.getStatus(conn.id).status !== 'connected'"
                  @click.stop="connect(conn.id)"
                >
                  <Plug class="mr-2 size-4" />
                  Connect
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-else
                  @click.stop="disconnect(conn.id)"
                >
                  <Unplug class="mr-2 size-4" />
                  Disconnect
                </DropdownMenuItem>
                <DropdownMenuItem @click.stop="openEditForm(conn.id)">
                  <Pencil class="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem class="text-destructive" @click.stop="confirmDelete(conn.id)">
                  <Trash2 class="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </button>
        </div>
      </ScrollArea>
    </PopoverContent>
  </Popover>

  <Dialog v-model:open="formDialogOpen">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editingConnectionId ? 'Edit Connection' : 'New Connection' }}</DialogTitle>
      </DialogHeader>
      <ConnectionForm
        :connection-id="editingConnectionId"
        hide-header
        @saved="onFormSaved"
        @cancel="formDialogOpen = false"
      />
    </DialogContent>
  </Dialog>

  <AlertDialog v-model:open="deleteDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Connection</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure? This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="executeDelete"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
