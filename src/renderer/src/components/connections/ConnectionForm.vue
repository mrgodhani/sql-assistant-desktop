<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { AcceptableValue } from 'reka-ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import type { ConnectionConfig, ConnectionTestResult, DatabaseType } from '../../../../shared/types'
import { DATABASE_TYPES, DATABASE_TYPE_LABELS, DEFAULT_PORTS } from '../../../../shared/types'

const props = defineProps<{
  connectionId?: string
  hideHeader?: boolean
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const store = useConnectionStore()

const form = reactive<ConnectionConfig>({
  name: '',
  type: 'postgresql' as DatabaseType,
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
  connectionString: '',
  sslEnabled: false,
  filePath: ''
})

const useConnectionString = ref(false)
const isTesting = ref(false)
const isSaving = ref(false)
const testResult = ref<ConnectionTestResult | null>(null)
const saveError = ref('')
const errors = reactive<Record<string, string>>({})

const isEditing = computed(() => Boolean(props.connectionId))
const defaultPort = computed(() => {
  if (form.type === 'sqlite') return ''
  return String(DEFAULT_PORTS[form.type])
})

watch(
  () => form.type,
  (newType) => {
    if (newType !== 'sqlite') {
      form.port = DEFAULT_PORTS[newType]
    }
    testResult.value = null
    clearErrors()
  }
)

onMounted(async () => {
  if (props.connectionId) {
    const conn = store.getConnection(props.connectionId)
    if (conn) {
      form.name = conn.name
      form.type = conn.type
      form.host = conn.host || 'localhost'
      form.port = conn.port || (conn.type !== 'sqlite' ? DEFAULT_PORTS[conn.type] : undefined)
      form.database = conn.database
      form.username = conn.username || ''
      form.password = ''
      form.sslEnabled = conn.sslEnabled
      form.filePath = conn.filePath || ''
    }
  }
})

function clearErrors(): void {
  Object.keys(errors).forEach((key) => delete errors[key])
  saveError.value = ''
}

function validate(): boolean {
  clearErrors()

  if (!form.name.trim()) errors.name = 'Name is required'
  else if (form.name.length > 100) errors.name = 'Name must be 100 characters or less'

  if (useConnectionString.value) {
    if (!form.connectionString?.trim()) errors.connectionString = 'Connection string is required'
  } else if (form.type === 'sqlite') {
    if (!form.filePath?.trim()) errors.filePath = 'Database file path is required'
  } else {
    if (!form.host?.trim()) errors.host = 'Host is required'
    if (!form.database?.trim()) errors.database = 'Database name is required'
    if (form.port && (form.port < 1 || form.port > 65535)) errors.port = 'Port must be 1-65535'
  }

  return Object.keys(errors).length === 0
}

function buildConfig(): ConnectionConfig {
  if (form.type === 'sqlite') {
    return {
      name: form.name.trim(),
      type: 'sqlite',
      database: form.filePath || form.database,
      sslEnabled: false,
      filePath: form.filePath
    }
  }

  return {
    name: form.name.trim(),
    type: form.type,
    host: form.host,
    port: form.port,
    database: form.database.trim(),
    username: form.username || undefined,
    password: form.password || undefined,
    connectionString: useConnectionString.value ? form.connectionString : undefined,
    sslEnabled: form.sslEnabled
  }
}

async function testConnection(): Promise<void> {
  if (!validate()) return

  isTesting.value = true
  testResult.value = null
  try {
    testResult.value = await store.testConnection(buildConfig())
  } finally {
    isTesting.value = false
  }
}

async function saveConnection(): Promise<void> {
  if (!validate()) return

  isSaving.value = true
  saveError.value = ''
  try {
    const config = buildConfig()
    if (isEditing.value && props.connectionId) {
      await store.updateConnection(props.connectionId, config)
    } else {
      await store.createConnection(config)
    }
    emit('saved')
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Failed to save connection'
  } finally {
    isSaving.value = false
  }
}

async function pickFile(): Promise<void> {
  const path = await store.pickSQLiteFile()
  if (path) {
    form.filePath = path
    form.database = path.split('/').pop() || path
  }
}

function onTypeChange(value: AcceptableValue): void {
  if (typeof value === 'string') form.type = value as DatabaseType
}
</script>

<template>
  <Card data-testid="connection-form">
    <CardHeader v-if="!props.hideHeader">
      <CardTitle>{{ isEditing ? 'Edit' : 'New' }} Connection</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="conn-name">Connection Name</Label>
        <Input
          id="conn-name"
          v-model="form.name"
          placeholder="My Database"
          data-testid="connection-form-name"
        />
        <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
      </div>

      <div class="space-y-2">
        <Label>Database Type</Label>
        <Select :model-value="form.type" @update:model-value="onTypeChange">
          <SelectTrigger data-testid="connection-form-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="t in DATABASE_TYPES" :key="t" :value="t">
              {{ DATABASE_TYPE_LABELS[t] }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="form.type !== 'sqlite'" class="flex items-center gap-2">
        <Switch v-model="useConnectionString" data-testid="connection-form-string-toggle" />
        <Label>Use connection string</Label>
      </div>

      <div v-if="useConnectionString && form.type !== 'sqlite'" class="space-y-2">
        <Label for="conn-string">Connection String</Label>
        <Textarea
          id="conn-string"
          v-model="form.connectionString"
          :placeholder="`${form.type === 'mysql' ? 'mysql' : form.type === 'sqlserver' ? 'mssql' : 'postgresql'}://user:pass@host:${defaultPort}/database`"
          data-testid="connection-form-connection-string"
        />
        <p v-if="errors.connectionString" class="text-sm text-destructive">
          {{ errors.connectionString }}
        </p>
      </div>

      <template v-else-if="form.type === 'sqlite'">
        <div class="space-y-2">
          <Label for="conn-filepath">Database File</Label>
          <div class="flex gap-2">
            <Input
              id="conn-filepath"
              v-model="form.filePath"
              placeholder="/path/to/database.db"
              class="flex-1"
              data-testid="connection-form-filepath"
            />
            <Button variant="outline" data-testid="connection-form-browse" @click="pickFile">
              Browse
            </Button>
          </div>
          <p v-if="errors.filePath" class="text-sm text-destructive">{{ errors.filePath }}</p>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-3 gap-4">
          <div class="col-span-2 space-y-2">
            <Label for="conn-host">Host</Label>
            <Input
              id="conn-host"
              v-model="form.host"
              placeholder="localhost"
              data-testid="connection-form-host"
            />
            <p v-if="errors.host" class="text-sm text-destructive">{{ errors.host }}</p>
          </div>
          <div class="space-y-2">
            <Label for="conn-port">Port</Label>
            <Input
              id="conn-port"
              v-model.number="form.port"
              type="number"
              :placeholder="defaultPort"
              data-testid="connection-form-port"
            />
            <p v-if="errors.port" class="text-sm text-destructive">{{ errors.port }}</p>
          </div>
        </div>
        <div class="space-y-2">
          <Label for="conn-database">Database</Label>
          <Input
            id="conn-database"
            v-model="form.database"
            placeholder="mydb"
            data-testid="connection-form-database"
          />
          <p v-if="errors.database" class="text-sm text-destructive">{{ errors.database }}</p>
        </div>
        <div class="space-y-2">
          <Label for="conn-username">Username</Label>
          <Input
            id="conn-username"
            v-model="form.username"
            data-testid="connection-form-username"
          />
        </div>
        <div class="space-y-2">
          <Label for="conn-password">Password</Label>
          <Input
            id="conn-password"
            v-model="form.password"
            type="password"
            :placeholder="isEditing ? '(unchanged)' : ''"
            data-testid="connection-form-password"
          />
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model="form.sslEnabled" data-testid="connection-form-ssl" />
          <Label>Enable SSL</Label>
        </div>
      </template>

      <div v-if="testResult" class="rounded-md border p-3">
        <p
          :class="testResult.success ? 'text-green-500' : 'text-destructive'"
          class="text-sm font-medium"
          data-testid="connection-form-test-result"
        >
          {{ testResult.message }}
          <span v-if="testResult.latencyMs" class="text-muted-foreground">
            ({{ testResult.latencyMs }}ms)
          </span>
        </p>
      </div>

      <p v-if="saveError" class="text-sm text-destructive" data-testid="connection-form-save-error">
        {{ saveError }}
      </p>
    </CardContent>

    <CardFooter class="flex justify-between">
      <Button
        variant="outline"
        :disabled="isTesting"
        data-testid="connection-form-test"
        @click="testConnection"
      >
        {{ isTesting ? 'Testing...' : 'Test Connection' }}
      </Button>
      <div class="flex gap-2">
        <Button variant="ghost" data-testid="connection-form-cancel" @click="$emit('cancel')">
          Cancel
        </Button>
        <Button :disabled="isSaving" data-testid="connection-form-save" @click="saveConnection">
          {{ isSaving ? 'Saving...' : isEditing ? 'Update' : 'Save' }}
        </Button>
      </div>
    </CardFooter>
  </Card>
</template>
