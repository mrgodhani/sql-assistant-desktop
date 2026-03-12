<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppSidebar from '@renderer/components/sidebar/AppSidebar.vue'
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
    <div class="flex flex-1 min-h-0">
      <AppSidebar />
      <main class="flex-1 overflow-hidden">
        <router-view />
      </main>
    </div>
    <SchemaSearchCommand v-model:open="schemaSearchOpen" />
  </div>
</template>
