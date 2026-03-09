<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore, PROVIDER_LABELS } from '@renderer/stores/useSettingsStore'
import { Badge } from '@/components/ui/badge'

const settingsStore = useSettingsStore()

const label = computed(() => {
  const providerName = PROVIDER_LABELS[settingsStore.activeProvider]
  return `${providerName} · ${settingsStore.activeModel}`
})
</script>

<template>
  <div class="flex items-center gap-2" data-testid="active-provider-badge">
    <span class="text-sm text-muted-foreground">Active:</span>
    <Badge variant="secondary">{{ label }}</Badge>
  </div>
</template>
