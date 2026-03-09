<script setup lang="ts">
import AppSidebar from '@renderer/components/sidebar/AppSidebar.vue'
import AppTopBar from '@renderer/components/layout/AppTopBar.vue'
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
  </div>
</template>
