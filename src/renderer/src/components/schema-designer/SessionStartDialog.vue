<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Database, Plus } from 'lucide-vue-next'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import { DATABASE_TYPES, DATABASE_TYPE_LABELS } from '../../../../shared/types'
import type { DatabaseType } from '../../../../shared/types'

const emit = defineEmits<{
  start: [
    config: { mode: 'scratch' | 'existing'; dialect?: DatabaseType; connectionId?: string }
  ]
}>()

const connectionStore = useConnectionStore()
const selectedDialect = ref<DatabaseType>('postgresql')
const selectedConnectionId = ref<string>('')
</script>

<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="grid gap-6 md:grid-cols-2 max-w-2xl w-full">
      <Card class="cursor-pointer transition-all hover:border-primary hover:shadow-md">
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Plus class="size-5 text-primary" />
            </div>
            <div>
              <CardTitle class="text-base">Start from Scratch</CardTitle>
              <CardDescription>Design a new database schema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-3">
          <div>
            <label class="text-sm font-medium mb-1.5 block">Target Dialect</label>
            <Select v-model="selectedDialect">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="dt in DATABASE_TYPES" :key="dt" :value="dt">
                  {{ DATABASE_TYPE_LABELS[dt] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            class="w-full"
            @click="emit('start', { mode: 'scratch', dialect: selectedDialect })"
          >
            Start Designing
          </Button>
        </CardContent>
      </Card>

      <Card class="cursor-pointer transition-all hover:border-primary hover:shadow-md">
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Database class="size-5 text-blue-500" />
            </div>
            <div>
              <CardTitle class="text-base">From Existing Database</CardTitle>
              <CardDescription>Evolve an existing schema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-3">
          <div>
            <label class="text-sm font-medium mb-1.5 block">Connection</label>
            <Select v-model="selectedConnectionId">
              <SelectTrigger>
                <SelectValue placeholder="Select a connection..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="conn in connectionStore.connections"
                  :key="conn.id"
                  :value="conn.id"
                >
                  {{ conn.name }} ({{ DATABASE_TYPE_LABELS[conn.type] }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            class="w-full"
            :disabled="!selectedConnectionId"
            @click="
              emit('start', { mode: 'existing', connectionId: selectedConnectionId })
            "
          >
            Load & Evolve
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
