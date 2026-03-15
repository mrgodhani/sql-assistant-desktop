<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import type { AIProvider } from '../../../../shared/types'
import { AI_PROVIDERS, PROVIDER_LABELS } from '../../../../shared/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ChevronDown } from 'lucide-vue-next'

const settingsStore = useSettingsStore()

const models = computed(
  () => settingsStore.providerConfigs[settingsStore.activeProvider].models
)

const displayLabel = computed(() =>
  settingsStore.activeModel
    ? settingsStore.activeModel
    : PROVIDER_LABELS[settingsStore.activeProvider]
)

watch(
  () => settingsStore.activeProvider,
  (provider) => {
    settingsStore.refreshModels(provider)
  },
  { immediate: true }
)

function onProviderChange(value: unknown): void {
  const provider = String(value ?? '')
  if (provider) settingsStore.setProvider(provider as AIProvider)
}

function onModelChange(value: unknown): void {
  const model = String(value ?? '')
  if (model) settingsStore.setModel(model)
}
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-1.5">
    <Popover>
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 text-xs text-muted-foreground"
          aria-label="AI provider and model"
        >
          {{ displayLabel }}
          <ChevronDown class="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-[280px]" align="start">
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Provider</Label>
            <Select
              :model-value="settingsStore.activeProvider"
              @update:model-value="onProviderChange"
            >
              <SelectTrigger aria-label="AI provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in AI_PROVIDERS" :key="p" :value="p">
                  {{ PROVIDER_LABELS[p] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Model</Label>
            <Select
              :model-value="settingsStore.activeModel"
              @update:model-value="onModelChange"
            >
              <SelectTrigger aria-label="AI model">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in models" :key="m" :value="m">
                  {{ m }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
