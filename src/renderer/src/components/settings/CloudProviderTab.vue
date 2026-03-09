<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import type { AIProvider, ValidationResult } from '@renderer/stores/useSettingsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { CheckCircle, XCircle, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  provider: AIProvider
}>()

const settingsStore = useSettingsStore()

const config = computed(() => settingsStore.providerConfigs[props.provider])
const isActive = computed(() => settingsStore.activeProvider === props.provider)
const hasBaseUrl = computed(() => props.provider === 'openrouter')

const apiKeyInput = ref('')
const isValidating = ref(false)
const validationResult = ref<ValidationResult | null>(null)

const maskedKey = computed(() => {
  const key = config.value.apiKey
  if (!key) return ''
  if (key.length <= 4) return '****'
  return `***...${key.slice(-4)}`
})

const showMasked = computed(() => Boolean(config.value.apiKey) && !apiKeyInput.value)

async function onApiKeyBlur(): Promise<void> {
  if (!apiKeyInput.value) return
  validationResult.value = null
  await settingsStore.updateProviderConfig(props.provider, {
    apiKey: apiKeyInput.value,
    enabled: true
  })
  apiKeyInput.value = ''
}

async function testApiKey(): Promise<void> {
  isValidating.value = true
  validationResult.value = null
  try {
    const keyToTest = apiKeyInput.value || config.value.apiKey || ''
    validationResult.value = await settingsStore.validateApiKey(props.provider, keyToTest)
  } finally {
    isValidating.value = false
  }
}

function onModelChange(model: string): void {
  settingsStore.updateProviderConfig(props.provider, { selectedModel: model })
  if (isActive.value) {
    settingsStore.setModel(model)
  }
}

function onBaseUrlChange(event: Event): void {
  const target = event.target as HTMLInputElement
  settingsStore.updateProviderConfig(props.provider, { baseUrl: target.value })
}

function setAsActive(): void {
  settingsStore.setProvider(props.provider)
}
</script>

<template>
  <div class="space-y-4 pt-4" :data-testid="`provider-tab-${provider}`">
    <div class="space-y-2">
      <Label>API Key</Label>
      <div class="flex gap-2">
        <Input
          type="password"
          :placeholder="showMasked ? maskedKey : 'Enter your API key'"
          v-model="apiKeyInput"
          :data-testid="`${provider}-api-key-input`"
          @blur="onApiKeyBlur"
        />
        <Button
          variant="outline"
          :disabled="isValidating || (!apiKeyInput && !config.apiKey)"
          :data-testid="`${provider}-test-key-button`"
          @click="testApiKey"
        >
          <Loader2 v-if="isValidating" class="mr-1 size-4 animate-spin" />
          {{ isValidating ? 'Testing...' : 'Test Key' }}
        </Button>
      </div>
      <p
        v-if="validationResult"
        :class="[
          'flex items-center gap-1 text-sm',
          validationResult.valid ? 'text-green-600 dark:text-green-400' : 'text-destructive'
        ]"
      >
        <CheckCircle v-if="validationResult.valid" class="size-4" />
        <XCircle v-else class="size-4" />
        {{ validationResult.message }}
      </p>
    </div>

    <div class="space-y-2">
      <Label>Model</Label>
      <Select :model-value="config.selectedModel" @update:model-value="onModelChange">
        <SelectTrigger :data-testid="`${provider}-model-select`">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="model in config.models" :key="model" :value="model">
            {{ model }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="hasBaseUrl" class="space-y-2">
      <Label>Base URL</Label>
      <Input
        :value="config.baseUrl"
        :data-testid="`${provider}-base-url-input`"
        @change="onBaseUrlChange"
      />
    </div>

    <Button
      variant="default"
      size="sm"
      :disabled="isActive"
      :data-testid="`${provider}-set-active-button`"
      @click="setAsActive"
    >
      {{ isActive ? 'Active Provider' : 'Set as Active' }}
    </Button>
  </div>
</template>
