<script setup lang="ts">
import ThemeSettings from '@renderer/components/settings/ThemeSettings.vue'
import ProviderSettings from '@renderer/components/settings/ProviderSettings.vue'
</script>

<template>
  <div class="h-full overflow-y-auto" data-testid="settings-view">
    <div class="mx-auto max-w-2xl p-6">
      <h1 class="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      <div class="space-y-6">
        <ThemeSettings />
        <ProviderSettings />
      </div>
    </div>
  </div>
</template>
