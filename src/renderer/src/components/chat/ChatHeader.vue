<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import { useConnectionStore } from '@renderer/stores/useConnectionStore'
import { useChatStore } from '@renderer/stores/useChatStore'
import type { AIProvider } from '../../../../shared/types'
import { AI_PROVIDERS, PROVIDER_LABELS } from '../../../../shared/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { PlusCircle } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
const connectionStore = useConnectionStore()
const chatStore = useChatStore()

const models = ref<string[]>([])

async function loadModels(): Promise<void> {
  try {
    models.value = await window.aiApi.listModels(settingsStore.activeProvider)
    if (models.value.length === 0) {
      models.value = settingsStore.providerConfigs[settingsStore.activeProvider].models
    }
  } catch {
    models.value = settingsStore.providerConfigs[settingsStore.activeProvider].models
  }
}

watch(() => settingsStore.activeProvider, loadModels, { immediate: true })

function onProviderChange(value: unknown): void {
  const provider = String(value ?? '')
  if (provider) settingsStore.setProvider(provider as AIProvider)
}

function onModelChange(value: unknown): void {
  const model = String(value ?? '')
  if (model) settingsStore.setModel(model)
}

function onConnectionChange(value: unknown): void {
  const id = String(value ?? '')
  chatStore.setActiveConnection(id === '__none__' || !id ? null : id)
}

function newChat(): void {
  chatStore.startNewConversation()
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2">
    <Select
      :model-value="settingsStore.activeProvider"
      @update:model-value="onProviderChange"
    >
      <SelectTrigger class="w-[140px]" aria-label="AI provider">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="p in AI_PROVIDERS"
          :key="p"
          :value="p"
        >
          {{ PROVIDER_LABELS[p] }}
        </SelectItem>
      </SelectContent>
    </Select>
    <Select
      :model-value="settingsStore.activeModel"
      @update:model-value="onModelChange"
    >
      <SelectTrigger class="w-[180px]" aria-label="AI model">
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="m in models"
          :key="m"
          :value="m"
        >
          {{ m }}
        </SelectItem>
      </SelectContent>
    </Select>
    <Select
      :model-value="chatStore.activeConnectionId ?? '__none__'"
      @update:model-value="onConnectionChange"
    >
      <SelectTrigger class="w-[160px]" aria-label="Database connection for schema context">
        <SelectValue placeholder="Connection" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No connection</SelectItem>
        <SelectItem
          v-for="c in connectionStore.connectedConnections"
          :key="c.id"
          :value="c.id"
        >
          {{ c.name }}
        </SelectItem>
      </SelectContent>
    </Select>
    <Button
      variant="outline"
      size="sm"
      class="gap-1"
      @click="newChat"
    >
      <PlusCircle class="size-4" />
      New Chat
    </Button>
  </div>
</template>
