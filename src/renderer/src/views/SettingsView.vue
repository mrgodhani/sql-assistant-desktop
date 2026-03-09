<script setup lang="ts">
import ThemeSettings from '@renderer/components/settings/ThemeSettings.vue'
import ProviderSettings from '@renderer/components/settings/ProviderSettings.vue'
import LogsSettings from '@renderer/components/settings/LogsSettings.vue'
</script>

<template>
  <div class="h-full overflow-y-auto" data-testid="settings-view">
    <div class="mx-auto max-w-2xl p-6">
      <div class="space-y-6">
        <ThemeSettings />
        <ProviderSettings />
        <LogsSettings />
      </div>
    </div>
  </div>
</template>
