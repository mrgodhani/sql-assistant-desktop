<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import AppLayout from '@renderer/layouts/AppLayout.vue'
import ErrorBoundary from '@renderer/components/shared/ErrorBoundary.vue'

const settingsStore = useSettingsStore()

onMounted(() => {
  settingsStore.loadSettings()
})
</script>

<template>
  <ErrorBoundary>
    <AppLayout />
  </ErrorBoundary>
</template>
