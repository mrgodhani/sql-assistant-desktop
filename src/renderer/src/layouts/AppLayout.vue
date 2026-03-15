<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppTopBar from '@renderer/components/layout/AppTopBar.vue'
import SchemaSearchCommand from '@renderer/components/chat/SchemaSearchCommand.vue'

const schemaSearchOpen = ref(false)

function onKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    schemaSearchOpen.value = !schemaSearchOpen.value
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background" data-testid="app-layout">
    <AppTopBar />
    <main class="flex-1 overflow-hidden">
      <router-view />
    </main>
    <SchemaSearchCommand v-model:open="schemaSearchOpen" />
  </div>
</template>
