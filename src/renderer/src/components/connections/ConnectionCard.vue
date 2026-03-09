<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import type { DatabaseConnection, ConnectionStatus } from '../../../../shared/types'
import { DATABASE_TYPE_LABELS } from '../../../../shared/types'

const props = defineProps<{
  connection: DatabaseConnection
  status: ConnectionStatus
  error?: string
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  connect: []
  disconnect: []
}>()

const isConnecting = ref(false)

const connectionSummary = computed(() => {
  if (props.connection.type === 'sqlite') {
    return props.connection.filePath || props.connection.database
  }
  const port = props.connection.port ? `:${props.connection.port}` : ''
  return `${props.connection.host || 'localhost'}${port}/${props.connection.database}`
})

const statusVariant = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'default' as const
    case 'connecting':
      return 'secondary' as const
    case 'error':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
})

const statusLabel = computed(() => {
  switch (props.status) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting...'
    case 'error':
      return 'Error'
    default:
      return 'Disconnected'
  }
})

async function handleConnect(): Promise<void> {
  isConnecting.value = true
  try {
    emit('connect')
  } finally {
    setTimeout(() => {
      isConnecting.value = false
    }, 500)
  }
}
</script>

<template>
  <Card data-testid="connection-card">
    <CardHeader class="flex-row items-center justify-between space-y-0 pb-2">
      <div class="space-y-1">
        <CardTitle class="text-base" data-testid="connection-card-name">
          {{ connection.name }}
        </CardTitle>
        <CardDescription>
          <span class="mr-2 font-medium">{{ DATABASE_TYPE_LABELS[connection.type] }}</span>
          <span class="text-muted-foreground">{{ connectionSummary }}</span>
        </CardDescription>
      </div>
      <Badge :variant="statusVariant" data-testid="connection-card-status">
        {{ statusLabel }}
      </Badge>
    </CardHeader>

    <CardContent v-if="status === 'error' && error" class="pt-0">
      <p class="text-sm text-destructive" data-testid="connection-card-error">{{ error }}</p>
    </CardContent>

    <CardFooter class="gap-2">
      <Button
        v-if="status === 'disconnected' || status === 'error'"
        size="sm"
        :disabled="isConnecting"
        data-testid="connection-card-connect"
        @click="handleConnect"
      >
        Connect
      </Button>
      <Button
        v-if="status === 'connected'"
        size="sm"
        variant="outline"
        data-testid="connection-card-disconnect"
        @click="$emit('disconnect')"
      >
        Disconnect
      </Button>
      <Button size="sm" variant="ghost" data-testid="connection-card-edit" @click="$emit('edit')">
        Edit
      </Button>
      <AlertDialog>
        <AlertDialogTrigger as-child>
          <Button
            size="sm"
            variant="ghost"
            class="text-destructive hover:text-destructive"
            data-testid="connection-card-delete"
          >
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{{ connection.name }}"?
              <span v-if="status === 'connected'">
                This will disconnect and remove the connection.
              </span>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="connection-card-delete-confirm"
              @click="$emit('delete')"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardFooter>
  </Card>
</template>
