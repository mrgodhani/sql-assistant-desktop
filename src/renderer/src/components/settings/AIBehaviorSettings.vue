<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import { Label } from '@/components/ui/label'

const settingsStore = useSettingsStore()

// Local draft: updates live on input, persisted on change.
// Synced from store so it stays accurate if settings load after mount.
const draft = ref(settingsStore.temperature)
watch(() => settingsStore.temperature, (v) => { draft.value = v })

const displayValue = computed(() => draft.value.toFixed(2))

const hint = computed(() => {
  if (draft.value <= 0.2) return 'Precise — minimal variation, best for SQL generation'
  if (draft.value <= 0.5) return 'Balanced — reliable with slight flexibility'
  return 'Creative — more varied, less predictable responses'
})

function onInput(event: Event): void {
  draft.value = parseFloat((event.target as HTMLInputElement).value)
}

function onChange(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value)
  draft.value = value
  settingsStore.setTemperature(value)
}
</script>

<template>
  <div data-testid="ai-behavior-settings">
    <h3 class="text-sm font-medium">AI Behavior</h3>
    <div class="mt-3 space-y-2">
      <div class="flex items-center justify-between">
        <Label for="temperature-slider">Response Style</Label>
        <span class="text-sm tabular-nums text-muted-foreground" data-testid="temperature-value">
          {{ displayValue }}
        </span>
      </div>
      <input
        id="temperature-slider"
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="draft"
        class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-secondary accent-primary"
        data-testid="temperature-slider"
        @input="onInput"
        @change="onChange"
      />
      <p class="text-xs text-muted-foreground" data-testid="temperature-hint">{{ hint }}</p>
    </div>
  </div>
</template>
