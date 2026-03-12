<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ChatToolbar from '@renderer/components/chat/ChatToolbar.vue'
import ConnectionsToolbar from '@renderer/components/layout/ConnectionsToolbar.vue'
import SettingsToolbar from '@renderer/components/layout/SettingsToolbar.vue'

const route = useRoute()
const isMac = computed(() => window.platformApi?.getPlatform() === 'darwin')

const toolbarComponent = computed(() => {
  if (route.path.startsWith('/chat')) return ChatToolbar
  if (route.path === '/connections') return ConnectionsToolbar
  if (route.path === '/settings') return SettingsToolbar
  return null
})
</script>

<template>
  <header
    class="flex h-12 shrink-0 items-center border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    data-testid="app-topbar"
  >
    <!-- Traffic lights safe area (macOS only) -->
    <div v-if="isMac" class="w-[70px] shrink-0" data-testid="traffic-lights-region" />
    <!-- Toolbar content - draggable on Mac -->
    <div class="flex flex-1 items-center gap-2 px-4 py-2" :class="{ 'app-region-drag': isMac }">
      <component
        :is="toolbarComponent"
        v-if="toolbarComponent"
        :class="{ 'app-region-no-drag': isMac }"
      />
    </div>
  </header>
</template>

<style scoped>
.app-region-drag {
  -webkit-app-region: drag;
}

.app-region-no-drag {
  -webkit-app-region: no-drag;
}
</style>
