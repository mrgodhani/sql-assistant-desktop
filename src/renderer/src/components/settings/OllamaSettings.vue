<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import type { ValidationResult } from '@renderer/stores/useSettingsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AcceptableValue } from 'reka-ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RefreshCw, CheckCircle, XCircle, Loader2, Plus } from 'lucide-vue-next'

const settingsStore = useSettingsStore()

const config = computed(() => settingsStore.providerConfigs.ollama)
const isActive = computed(() => settingsStore.activeProvider === 'ollama')

const baseUrlInput = ref('')
const customModelName = ref('')
const isTesting = ref(false)
const isRefreshing = ref(false)
const connectionResult = ref<ValidationResult | null>(null)

function onBaseUrlBlur(): void {
  if (!baseUrlInput.value) return
  settingsStore.updateProviderConfig('ollama', { baseUrl: baseUrlInput.value })
  baseUrlInput.value = ''
  connectionResult.value = null
}

async function testConnection(): Promise<void> {
  isTesting.value = true
  connectionResult.value = null
  try {
    const url = baseUrlInput.value || config.value.baseUrl || 'http://localhost:11434'
    connectionResult.value = await settingsStore.validateApiKey('ollama', url)
  } finally {
    isTesting.value = false
  }
}

async function refreshModels(): Promise<void> {
  isRefreshing.value = true
  try {
    const models = await settingsStore.refreshModels('ollama')
    if (models.length === 0) {
      connectionResult.value = { valid: false, message: 'No models found — is Ollama running?' }
    } else {
      connectionResult.value = { valid: true, message: `Found ${models.length} models` }
    }
  } finally {
    isRefreshing.value = false
  }
}

function addCustomModel(): void {
  const name = customModelName.value.trim()
  if (!name) return
  if (config.value.models.includes(name)) {
    customModelName.value = ''
    return
  }
  const updated = [...config.value.models, name]
  settingsStore.updateProviderConfig('ollama', { models: updated })
  customModelName.value = ''
}

function onModelChange(model: AcceptableValue): void {
  if (typeof model === 'string') {
    settingsStore.updateProviderConfig('ollama', { selectedModel: model })
    if (isActive.value) {
      settingsStore.setModel(model)
    }
  }
}

function setAsActive(): void {
  settingsStore.setProvider('ollama')
}
</script>

<template>
  <div class="space-y-4 pt-4" data-testid="provider-tab-ollama">
    <div class="space-y-2">
      <Label>Server URL</Label>
      <div class="flex gap-2">
        <Input
          v-model="baseUrlInput"
          :placeholder="config.baseUrl || 'http://localhost:11434'"
          data-testid="ollama-base-url-input"
          @blur="onBaseUrlBlur"
        />
        <Button
          variant="outline"
          :disabled="isTesting"
          data-testid="ollama-test-button"
          @click="testConnection"
        >
          <Loader2 v-if="isTesting" class="mr-1 size-4 animate-spin" />
          {{ isTesting ? 'Testing...' : 'Test' }}
        </Button>
      </div>
      <p
        v-if="connectionResult"
        :class="[
          'flex items-center gap-1 text-sm',
          connectionResult.valid ? 'text-green-600 dark:text-green-400' : 'text-destructive'
        ]"
      >
        <CheckCircle v-if="connectionResult.valid" class="size-4" />
        <XCircle v-else class="size-4" />
        {{ connectionResult.message }}
      </p>
    </div>

    <div class="space-y-2">
      <Label>Model</Label>
      <div class="flex gap-2">
        <Select :model-value="config.selectedModel" @update:model-value="onModelChange">
          <SelectTrigger data-testid="ollama-model-select">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="model in config.models" :key="model" :value="model">
              {{ model }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          :disabled="isRefreshing"
          data-testid="ollama-refresh-models-button"
          @click="refreshModels"
        >
          <RefreshCw :class="['size-4', { 'animate-spin': isRefreshing }]" />
        </Button>
      </div>
    </div>

    <div class="space-y-2">
      <Label>Add Custom Model</Label>
      <div class="flex gap-2">
        <Input
          v-model="customModelName"
          placeholder="e.g., llama3.2:latest"
          data-testid="ollama-custom-model-input"
          @keydown.enter="addCustomModel"
        />
        <Button
          variant="outline"
          :disabled="!customModelName.trim()"
          data-testid="ollama-add-model-button"
          @click="addCustomModel"
        >
          <Plus class="mr-1 size-4" />
          Add
        </Button>
      </div>
    </div>

    <Button
      variant="default"
      size="sm"
      :disabled="isActive"
      data-testid="ollama-set-active-button"
      @click="setAsActive"
    >
      {{ isActive ? 'Active Provider' : 'Set as Active' }}
    </Button>
  </div>
</template>
