<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import AppLayout from '@renderer/layouts/AppLayout.vue'

const settingsStore = useSettingsStore()

onMounted(() => {
  settingsStore.loadSettings()
})
</script>

<template>
  <AppLayout />
</template>
