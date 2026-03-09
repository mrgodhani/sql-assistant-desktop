<script setup lang="ts">
import AppSidebar from '@renderer/components/sidebar/AppSidebar.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background" data-testid="app-layout">
    <AppSidebar />
    <main class="flex-1 overflow-hidden">
      <router-view />
    </main>
  </div>
</template>
